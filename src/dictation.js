import { state, el } from './state.js';
import { setStatus } from './ui.js';
import { triggerAutoSave } from './notes.js';

// ---------- DICTATION (speech to text con deduplicación móvil y anti-repetición) ----------
let recognition = null;
let textBeforeDictation = '';
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;

export function cleanSpeechChunk(text){
  return (text || '').trim().replace(/[ \t]+/g, ' ');
}

// Elimina palabras adyacentes repetidas por tartamudeo o duplicación del sintetizador móvil
// Conserva duplicaciones válidas naturales en español (ej. "muy muy", "sí sí", "ya ya")
export function deduplicateAdjacentWords(str){
  if(!str) return '';
  const words = str.split(/\s+/);
  if(words.length <= 1) return str;

  const allowedDoubles = new Set(['muy', 'si', 'sí', 'ya', 'no', 'casi', 'tan', 'bien']);
  const cleaned = [];

  for(let i = 0; i < words.length; i++){
    const curr = words[i];
    if(!curr) continue;
    const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : null;

    if(prev){
      const currNorm = curr.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const prevNorm = prev.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

      if(currNorm && currNorm === prevNorm){
        // Si es una 3ra repetición consecutiva idéntica (ej. "palabra palabra palabra"), siempre omitir
        const prevPrev = cleaned.length > 1 ? cleaned[cleaned.length - 2] : null;
        const prevPrevNorm = prevPrev ? prevPrev.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') : null;
        if(prevPrevNorm === currNorm){
          continue;
        }

        // Si es una 2da repetición consecutiva y no pertenece al conjunto permitido, omitir
        if(!allowedDoubles.has(currNorm)){
          continue;
        }
      }
    }

    cleaned.push(curr);
  }

  return cleaned.join(' ');
}

// Ensambla los fragmentos reconocidos resolviendo el bug móvil de Android/WebKit
// donde los resultados se emiten acumulativos, con prefijos repetidos o con event.resultIndex = 0
export function stitchSpeechTranscripts(chunks){
  const result = [];

  for(let chunk of chunks){
    const clean = cleanSpeechChunk(chunk);
    if(!clean) continue;

    if(result.length === 0){
      result.push(clean);
      continue;
    }

    const prevIndex = result.length - 1;
    const prev = result[prevIndex];
    const prevLower = prev.toLowerCase();
    const cleanLower = clean.toLowerCase();

    // 1. Fragmento idéntico al anterior emitido dos veces
    if(prevLower === cleanLower){
      continue;
    }

    // 2. El fragmento anterior ya incluye este texto al final
    if(prevLower.endsWith(cleanLower)){
      continue;
    }

    // 3. Este fragmento engloba y extiende al anterior (bug acumulativo de Android Chrome)
    // Ej: prev era "hola", y el nuevo chunk es "hola cómo estás"
    if(cleanLower.startsWith(prevLower)){
      result[prevIndex] = clean;
      continue;
    }

    // 4. Traslape de palabras en el límite entre fragmentos
    // Ej: prev termina con "vamos a" y clean empieza con "a la reunión"
    const prevWords = prev.split(/\s+/);
    const cleanWords = clean.split(/\s+/);
    let overlapCount = 0;
    const maxOverlap = Math.min(prevWords.length, cleanWords.length, 6);

    for(let k = maxOverlap; k >= 1; k--){
      const prevEnd = prevWords.slice(prevWords.length - k).map(w => w.toLowerCase()).join(' ');
      const cleanStart = cleanWords.slice(0, k).map(w => w.toLowerCase()).join(' ');
      if(prevEnd === cleanStart){
        overlapCount = k;
        break;
      }
    }

    if(overlapCount > 0){
      const nonOverlapping = cleanWords.slice(overlapCount).join(' ');
      if(nonOverlapping){
        result[prevIndex] = prev + ' ' + nonOverlapping;
      }
    } else {
      result.push(clean);
    }
  }

  return deduplicateAdjacentWords(result.join(' '));
}

export function setupDictation(){
  if(!SR){
    if(el.dictateBtn){
      el.dictateBtn.disabled = true;
      el.dictateBtn.title = 'Dictado por voz no disponible en este navegador';
      el.dictateBtn.textContent = '🎙️ No disponible';
    }
    return;
  }
  try {
    recognition = new SR();
    const userLang = (navigator.language || '').replace(/_/g, '-');
    recognition.lang = userLang.toLowerCase().startsWith('es') ? userLang : 'es-CL';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.recognizing = true;
      const currentVal = el.editor.value || '';
      textBeforeDictation = currentVal;
      if(textBeforeDictation && !textBeforeDictation.endsWith(' ') && !textBeforeDictation.endsWith('\n')){
        textBeforeDictation += ' ';
      }
      if(el.dictateBtn){
        el.dictateBtn.classList.add('on');
        el.dictateBtn.textContent = '🎙️ Escuchando…';
      }
      setStatus('Escuchando… habla con naturalidad');
    };

    recognition.onresult = (event) => {
      if(!event || !event.results) return;

      // En Android/móvil, event.resultIndex a menudo se reinicia en 0 en cada evento.
      // En lugar de acumular en un arreglo externo sin sincronía, leemos directamente
      // event.results de esta sesión y lo ensamblamos con desduplicación inteligente.
      const finalChunks = [];
      let rawInterim = '';

      for(let i = 0; i < event.results.length; ++i){
        const res = event.results[i];
        if(!res || !res[0]) continue;
        const transcript = cleanSpeechChunk(res[0].transcript);
        if(!transcript) continue;

        if(res.isFinal){
          finalChunks.push(transcript);
        } else {
          rawInterim += (rawInterim ? ' ' : '') + transcript;
        }
      }

      const finalSpeech = stitchSpeechTranscripts(finalChunks);
      let cleanInterim = cleanSpeechChunk(rawInterim);

      // Prevenir colisiones: quitar del interim palabras que ya fueron consolidadas en finalSpeech
      if(cleanInterim && finalSpeech){
        const finalLower = finalSpeech.toLowerCase();
        const interimLower = cleanInterim.toLowerCase();

        if(finalLower.endsWith(interimLower) || finalLower === interimLower){
          cleanInterim = '';
        } else if(interimLower.startsWith(finalLower)){
          cleanInterim = cleanInterim.slice(finalSpeech.length).trim();
        } else {
          const fWords = finalSpeech.split(/\s+/);
          const iWords = cleanInterim.split(/\s+/);
          let overlap = 0;
          const maxOverlap = Math.min(fWords.length, iWords.length, 6);
          for(let k = maxOverlap; k >= 1; k--){
            const fEnd = fWords.slice(fWords.length - k).map(w => w.toLowerCase()).join(' ');
            const iStart = iWords.slice(0, k).map(w => w.toLowerCase()).join(' ');
            if(fEnd === iStart){
              overlap = k;
              break;
            }
          }
          if(overlap > 0){
            cleanInterim = iWords.slice(overlap).join(' ');
          }
        }
      }

      let sessionSpeech = finalSpeech;
      if(cleanInterim){
        sessionSpeech += (sessionSpeech ? ' ' : '') + cleanInterim;
      }

      el.editor.value = textBeforeDictation + sessionSpeech;
      triggerAutoSave();
    };

    recognition.onerror = (e) => {
      if(e && e.error === 'no-speech'){
        return;
      }
      if(e && e.error === 'not-allowed'){
        setStatus('Permiso de micrófono denegado. Actívalo en la barra del navegador.', true);
      } else if(e && e.error === 'audio-capture'){
        setStatus('No se detectó ningún micrófono conectado.', true);
      } else {
        setStatus('No se pudo acceder al micrófono.', true);
      }
      stopDictation();
    };

    recognition.onend = () => {
      stopDictation();
      if(el.editor){
        el.editor.value = el.editor.value.replace(/[ \t]+$/, '');
      }
      triggerAutoSave();
      setStatus('Dictado finalizado. Pulsa 🎙️ para volver a dictar.');
    };
  } catch(err) {
    console.warn('SpeechRecognition initialization error:', err);
    recognition = null;
    if(el.dictateBtn){
      el.dictateBtn.disabled = true;
      el.dictateBtn.title = 'No se pudo iniciar el servicio de dictado';
      el.dictateBtn.textContent = '🎙️ No disponible';
    }
  }
}

export function stopDictation(){
  state.recognizing = false;
  textBeforeDictation = '';
  if(el.dictateBtn && SR){
    el.dictateBtn.classList.remove('on');
    el.dictateBtn.textContent = '🎙️ Dictar';
  }
}

export function toggleDictation(){
  if(!SR){
    setStatus('El dictado por voz requiere Google Chrome, Edge o Safari moderno.', true);
    return;
  }
  if(!recognition){
    setupDictation();
  }
  if(!recognition){
    setStatus('No se pudo inicializar el micrófono en este dispositivo.', true);
    return;
  }
  if(state.recognizing){
    try { recognition.stop(); } catch(e){}
    stopDictation();
    setStatus('Dictado pausado.');
  } else {
    try {
      recognition.start();
    } catch(e){
      try {
        recognition.stop();
      } catch(stopErr){}
      setTimeout(() => {
        try {
          recognition.start();
        } catch(retryErr){
          setStatus('No se pudo iniciar el micrófono. Revisa los permisos.', true);
        }
      }, 150);
    }
  }
}
