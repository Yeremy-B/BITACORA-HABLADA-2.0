import { state, el } from './state.js';
import { escapeHtml } from './utils.js';
import { storageGet, storageSet } from './storage.js';
import { setStatus } from './ui.js';

// ---------- TEXT TO SPEECH ----------
export function isSpanishVoice(v){
  if(!v) return false;
  const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
  const name = (v.name || '').toLowerCase();
  return lang.startsWith('es') || lang.startsWith('spa') || name.includes('spanish') || name.includes('español') || name.includes('castilian');
}

// Detecta si una voz del sistema es masculina o femenina según palabras clave internacionales y de fabricantes
export function detectVoiceGender(v){
  if(!v) return 'unknown';
  const name = (v.name || '').toLowerCase();
  const id = (v.voiceURI || '').toLowerCase();
  const combined = `${name} ${id}`;

  // Patrones masculinos conocidos
  const malePatterns = [
    'male', 'hombre', 'masculin', 'guy', 'david', 'jorge', 'pablo', 'raul', 'raúl',
    'diego', 'miguel', 'carlos', 'enrique', 'alvaro', 'álvaro', 'mateo', 'gonzalo',
    'pedro', 'juan', 'manuel', 'luis', 'fernando', 'andres', 'andrés', 'sergio',
    'javier', 'antonio', 'victor', 'víctor', 'alberto', 'gabriel', 'sebastian',
    'sebastián', 'hugo', 'alejandro', 'rodrigo', 'ricardo', 'esteban', 'felipe',
    'alex', 'george', 'daniel', 'mario', 'thomas', 'oliver', 'marcus'
  ];

  // Patrones femeninos conocidos
  const femalePatterns = [
    'female', 'mujer', 'femenin', 'woman', 'girl', 'monica', 'mónica', 'paulina',
    'francisca', 'luciana', 'helena', 'elena', 'laura', 'carmen', 'conchita',
    'penelope', 'penélope', 'lupe', 'victoria', 'sofia', 'sofía', 'maria', 'maría',
    'valeria', 'camila', 'paloma', 'samantha', 'victoria', 'karen', 'clara', 'eva',
    'zira', 'siri female', 'female voice'
  ];

  for(const p of malePatterns){
    // Evitar falsos positivos como "diego" dentro de otra palabra
    if(new RegExp(`\\b${p}\\b`, 'i').test(combined) || combined.includes(p)){
      return 'male';
    }
  }
  for(const p of femalePatterns){
    if(new RegExp(`\\b${p}\\b`, 'i').test(combined) || combined.includes(p)){
      return 'female';
    }
  }

  return 'unknown';
}

export function getVoiceDisplayName(v, isDefault){
  const name = v.name || 'Voz';
  const lang = (v.lang || '').replace(/_/g, '-');
  const gender = detectVoiceGender(v);

  let genderBadge = '';
  if(gender === 'male'){
    genderBadge = ' 👨 [Masculina]';
  } else if(gender === 'female'){
    genderBadge = ' 👩 [Femenina]';
  }

  let flag = '🎙️';
  if(lang.startsWith('es-ES') || lang === 'es') flag = '🇪🇸';
  else if(lang.startsWith('es-MX')) flag = '🇲🇽';
  else if(lang.startsWith('es-US')) flag = '🇺🇸';
  else if(lang.startsWith('es-AR')) flag = '🇦🇷';
  else if(lang.startsWith('es-CO')) flag = '🇨🇴';
  else if(lang.startsWith('es-CL')) flag = '🇨🇱';
  else if(lang.startsWith('es')) flag = '🌎';

  let label = `${flag} ${name}${genderBadge}` + (lang ? ` (${lang})` : '');
  if(isDefault){
    label += ' ★ Predeterminada';
  }
  return label;
}

export async function findBestDefaultVoice(allVoices, filterGender = 'male'){
  if(!allVoices || allVoices.length === 0) return null;

  // 1. Preferencia guardada previamente por el usuario si coincide con el filtro
  const savedVoice = await storageGet('preferredVoice');
  if(savedVoice){
    const found = allVoices.find(v => v.name === savedVoice);
    if(found){
      const g = detectVoiceGender(found);
      if(filterGender === 'all' || g === filterGender || (filterGender === 'male' && g !== 'female')){
        return found;
      }
    }
  }

  // 2. Si se solicitan voces masculinas, buscar preferentemente las masculinas en español
  if(filterGender === 'male'){
    const maleSpanishKeywords = [
      'jorge', 'pablo', 'raul', 'diego', 'miguel', 'carlos', 'enrique',
      'mateo', 'gonzalo', 'pedro', 'juan', 'manuel', 'male', 'hombre'
    ];
    for(const kw of maleSpanishKeywords){
      const match = allVoices.find(v => isSpanishVoice(v) && v.name.toLowerCase().includes(kw));
      if(match) return match;
    }
    const anyMaleSpanish = allVoices.find(v => isSpanishVoice(v) && detectVoiceGender(v) === 'male');
    if(anyMaleSpanish) return anyMaleSpanish;
  }

  // 3. Voz en español que coincida con el idioma del navegador/sistema
  const userLang = (navigator.language || '').toLowerCase().replace(/_/g, '-');
  const matchLangVoice = allVoices.find(v => isSpanishVoice(v) && v.lang && v.lang.toLowerCase().replace(/_/g, '-') === userLang);
  if(matchLangVoice && (filterGender === 'all' || detectVoiceGender(matchLangVoice) === filterGender)) return matchLangVoice;

  // 4. Voces de alta calidad en español habituales en móviles y sistemas
  const preferredKeywords = [
    'google español', 'google spanish', 'jorge', 'pablo', 'diego', 'raul',
    'miguel', 'enrique', 'mónica', 'monica', 'paulina', 'francisca',
    'luciana', 'helena', 'neural', 'natural'
  ];
  for(const kw of preferredKeywords){
    const match = allVoices.find(v => isSpanishVoice(v) && v.name.toLowerCase().includes(kw));
    if(match && (filterGender === 'all' || detectVoiceGender(match) === filterGender || filterGender === 'male')) return match;
  }

  // 5. Primera voz en español
  const anySpanish = allVoices.find(isSpanishVoice);
  if(anySpanish) return anySpanish;

  // 6. Primera voz disponible
  return allVoices[0];
}

let populateRetryCount = 0;
let populateRetryTimer = null;

export async function populateVoices(){
  if(!('speechSynthesis' in window)){
    if(el.voiceSelect){
      el.voiceSelect.innerHTML = '<option value="">Síntesis de voz no disponible</option>';
    }
    return;
  }

  const all = window.speechSynthesis.getVoices() || [];
  state.allVoices = all;
  state.voices = all.filter(isSpanishVoice);

  if(all.length === 0){
    if(el.voiceSelect){
      el.voiceSelect.innerHTML = '<option value="">Cargando voces del dispositivo…</option>';
    }
    // Reintentar en móviles y tablets (iOS Safari y Android cargan las voces de forma diferida)
    if(populateRetryCount < 10){
      populateRetryCount++;
      clearTimeout(populateRetryTimer);
      populateRetryTimer = setTimeout(populateVoices, populateRetryCount * 250);
    }
    return;
  }

  clearTimeout(populateRetryTimer);

  const genderFilter = state.voiceGenderFilter || 'male';
  const filterFn = (v) => {
    if(genderFilter === 'all') return true;
    const g = detectVoiceGender(v);
    if(genderFilter === 'male') {
      // En modo masculina, mostrar voces reconocidas como masculinas o neutras si no hay explícitamente masculinas
      return g === 'male' || g === 'unknown';
    }
    if(genderFilter === 'female') {
      return g === 'female' || g === 'unknown';
    }
    return true;
  };

  const bestVoice = await findBestDefaultVoice(all, genderFilter);
  const savedVoice = await storageGet('preferredVoice');
  const savedVoiceObj = savedVoice ? all.find(v => v.name === savedVoice) : null;
  const savedMatchesGender = savedVoiceObj && filterFn(savedVoiceObj);
  const targetVoiceName = (savedMatchesGender ? savedVoice : null)
    || (bestVoice ? bestVoice.name : (all[0] ? all[0].name : ''));

  el.voiceSelect.innerHTML = '';

  let spanishList = state.voices.filter(filterFn);
  let otherList = all.filter(v => !isSpanishVoice(v) && filterFn(v));

  // Si el filtro específico no arrojó resultados, mostrar todas para no dejar el selector vacío
  if(spanishList.length === 0 && otherList.length === 0){
    spanishList = state.voices;
    otherList = all.filter(v => !isSpanishVoice(v));
  }

  if(spanishList.length > 0){
    const esGroup = document.createElement('optgroup');
    esGroup.label = genderFilter === 'male' ? 'Voces Masculinas en Español' : (genderFilter === 'female' ? 'Voces Femeninas en Español' : 'Voces en Español (Recomendadas)');
    spanishList.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = getVoiceDisplayName(v, bestVoice && v.name === bestVoice.name);
      esGroup.appendChild(opt);
    });
    el.voiceSelect.appendChild(esGroup);
  }

  if(otherList.length > 0){
    const otherGroup = document.createElement('optgroup');
    otherGroup.label = spanishList.length > 0 ? 'Otros idiomas' : 'Voces disponibles';
    otherList.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      const g = detectVoiceGender(v);
      const gLabel = g === 'male' ? ' [👨]' : (g === 'female' ? ' [👩]' : '');
      opt.textContent = `${v.name}${gLabel} (${v.lang || 'idioma'})` + (v.default ? ' ★' : '');
      otherGroup.appendChild(opt);
    });
    el.voiceSelect.appendChild(otherGroup);
  }

  if(targetVoiceName && Array.from(el.voiceSelect.options).some(o => o.value === targetVoiceName)){
    el.voiceSelect.value = targetVoiceName;
  } else if(el.voiceSelect.options.length > 0){
    el.voiceSelect.selectedIndex = 0;
  }

  // Pre-establecer y persistir la voz por defecto si aún no había una configurada
  if(!savedVoice && el.voiceSelect.value){
    await storageSet('preferredVoice', el.voiceSelect.value);
  }
}

let speechKeepAliveTimer = null;
export function startSpeechKeepAlive(){
  stopSpeechKeepAlive();
  speechKeepAliveTimer = setInterval(() => {
    if('speechSynthesis' in window && window.speechSynthesis.speaking && !window.speechSynthesis.paused){
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);
}
export function stopSpeechKeepAlive(){
  if(speechKeepAliveTimer){
    clearInterval(speechKeepAliveTimer);
    speechKeepAliveTimer = null;
  }
}

export function buildReadingWords(text){
  // Divide el texto en palabras respetando saltos de línea y espaciado original
  const matches = [...text.matchAll(/\S+/g)];
  let html = '';
  let lastIndex = 0;
  for(const m of matches){
    const gap = text.slice(lastIndex, m.index);
    html += escapeHtml(gap);
    html += `<span class="rword" data-start="${m.index}">${escapeHtml(m[0])}</span>`;
    lastIndex = m.index + m[0].length;
  }
  html += escapeHtml(text.slice(lastIndex));
  el.readingText.innerHTML = html;
  return matches.map(m => ({ start: m.index, end: m.index + m[0].length }));
}

export function speak(text, isPreview = false){
  if(!('speechSynthesis' in window)){
    setStatus('Este navegador no admite lectura por voz.', true);
    return;
  }
  text = (text || el.editor.value).trim();
  if(!text){
    setStatus('Escribe o dicta algo en el editor antes de escuchar.', true);
    if(el.editor) el.editor.focus();
    return;
  }

  // En móviles y tablets, asegurar que el canal de síntesis esté activo
  try {
    window.speechSynthesis.cancel();
    if(window.speechSynthesis.paused){
      window.speechSynthesis.resume();
    }
  } catch(e){}

  const all = (state.allVoices && state.allVoices.length > 0)
    ? state.allVoices
    : (window.speechSynthesis.getVoices() || []);

  const chosenName = el.voiceSelect ? el.voiceSelect.value : '';
  let voice = all.find(v => v.name === chosenName);

  if(!voice){
    voice = all.find(isSpanishVoice) || all.find(v => v.default) || all[0];
    if(voice && el.voiceSelect){
      el.voiceSelect.value = voice.name;
    }
  }

  const utter = new SpeechSynthesisUtterance(text);
  if(voice){
    utter.voice = voice;
    utter.lang = voice.lang || 'es-ES';
  } else {
    utter.lang = (navigator.language && navigator.language.toLowerCase().startsWith('es')) ? navigator.language : 'es-ES';
  }
  utter.rate = 1.0;

  // Modulación de tono según la configuración (grave/masculino, profundo, normal o agudo)
  const pitchMode = state.voicePitch || (el.voicePitchSelect ? el.voicePitchSelect.value : 'male');
  if(pitchMode === 'deep'){
    utter.pitch = 0.72; // Timbre muy grave
  } else if(pitchMode === 'male'){
    utter.pitch = 0.84; // Timbre masculino natural cálido
  } else if(pitchMode === 'high'){
    utter.pitch = 1.25; // Timbre agudo
  } else {
    utter.pitch = 1.0;  // Tono original de la voz
  }

  let words = [];
  let spans = [];
  let activeSpan = null;

  if(!isPreview){
    words = buildReadingWords(text);
    spans = el.readingText.querySelectorAll('.rword');

    utter.onboundary = (event) => {
      if(event.name && event.name !== 'word') return;
      let idx = words.findIndex(w => event.charIndex >= w.start && event.charIndex < w.end);
      if(idx === -1){
        idx = words.findIndex(w => w.start >= event.charIndex);
      }
      if(idx === -1) return;
      if(activeSpan) activeSpan.classList.remove('active');
      activeSpan = spans[idx];
      if(activeSpan){
        activeSpan.classList.add('active');
        activeSpan.scrollIntoView({ block:'center', behavior:'smooth' });
      }
    };
  }

  utter.onstart = () => {
    state.speaking = true;
    startSpeechKeepAlive();
    el.waveform.classList.add('speaking');
    if(isPreview){
      if(el.previewVoiceBtn){
        el.previewVoiceBtn.textContent = '🔊 Probando…';
        el.previewVoiceBtn.disabled = true;
      }
    } else {
      el.stopBtn.disabled = false;
      el.playBtn.disabled = true;
      el.readingOverlay.classList.add('open');
    }
  };
  utter.onend = utter.onerror = () => {
    stopSpeechKeepAlive();
    state.speaking = false;
    el.waveform.classList.remove('speaking');
    if(isPreview){
      if(el.previewVoiceBtn){
        el.previewVoiceBtn.textContent = '👂 Probar';
        el.previewVoiceBtn.disabled = false;
      }
    } else {
      el.stopBtn.disabled = true;
      el.playBtn.disabled = false;
      el.readingOverlay.classList.remove('open');
      if(activeSpan) activeSpan.classList.remove('active');
    }
  };
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(){
  stopSpeechKeepAlive();
  if('speechSynthesis' in window){
    window.speechSynthesis.cancel();
  }
  state.speaking = false;
  el.waveform.classList.remove('speaking');
  el.stopBtn.disabled = true;
  el.playBtn.disabled = false;
  el.readingOverlay.classList.remove('open');
}
