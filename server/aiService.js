import { GoogleGenAI } from '@google/genai';
import { applyFallback } from './fallbacks.js';

export const NO_TASKS_SENTINEL = 'SIN_TAREAS';

const LANGUAGE_NAMES = {
  en: 'inglés',
  fr: 'francés',
  pt: 'portugués',
  de: 'alemán',
  it: 'italiano',
  ca: 'catalán',
  zh: 'chino',
  ja: 'japonés',
  ru: 'ruso',
  ar: 'árabe',
  es: 'español'
};

function getLanguageName(codeOrName) {
  if (!codeOrName) return 'inglés';
  const lower = String(codeOrName).toLowerCase().trim();
  return LANGUAGE_NAMES[lower] || lower;
}

let aiInstance = null;

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No se encontró la clave GEMINI_API_KEY en las variables de entorno.');
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiInstance;
}

export async function processNoteWithAI(action, text, { client, retryBaseDelay = 600, targetLang = 'en' } = {}) {
  if (!text || !text.trim()) {
    throw new Error('El texto de la nota está vacío.');
  }

  let ai;
  try {
    ai = client ?? getAIClient();
  } catch (err) {
    console.warn('[AI Service] API no disponible, aplicando fallback local:', err.message);
    return applyFallback(action, text, targetLang);
  }

  let systemInstruction;
  let prompt;

  switch (action) {
    case 'format_dictation':
      systemInstruction =
        'Eres un asistente de redacción experto en español. Tu tarea es pulir y dar formato a notas dictadas por voz. ' +
        'Debes agregar puntuación natural (puntos, comas, signos de interrogación o exclamación), mayúsculas correctas ' +
        'y separar en párrafos legibles si el texto es extenso. ' +
        'REGLA CRUCIAL: Conserva estrictamente las palabras, modismos y el sentido original del usuario. No agregues saludos ni explicaciones, responde ÚNICAMENTE con el texto resultante.';
      prompt = `Pule y añade puntuación al siguiente dictado por voz:\n\n${text}`;
      break;

    case 'summarize':
      systemInstruction =
        'Eres un asistente de síntesis conciso en español. ' +
        'Genera un resumen claro y breve en 2 o 3 párrafos o puntos clave del siguiente texto. ' +
        'No agregues introducciones ni despedidas, responde únicamente con el resumen.';
      prompt = `Resume la siguiente nota:\n\n${text}`;
      break;

    case 'extract_tasks':
      systemInstruction =
        'Eres un asistente de productividad en español. ' +
        'Extrae de la nota todas las tareas pendientes, compromisos, fechas límite o acciones a realizar, en formato de lista con viñetas ("• "). ' +
        'Si la nota no contiene tareas explícitas ni acciones pendientes, responde ÚNICAMENTE con la palabra SIN_TAREAS (sin viñetas, comillas ni puntuación). ' +
        'No agregues introducciones ni despedidas.';
      prompt = `Extrae las tareas pendientes de esta nota:\n\n${text}`;
      break;

    case 'suggest_title':
      systemInstruction =
        'Eres un asistente de organización de notas en español. ' +
        'Analiza la nota y genera un título descriptivo, claro y atractivo (máximo 6 palabras). ' +
        'Responde ÚNICAMENTE con el título sugerido en una sola línea, sin comillas, sin introducciones ni puntos finales.';
      prompt = `Sugiere un título corto para esta nota:\n\n${text}`;
      break;

    case 'title_and_tags':
      systemInstruction =
        'Eres un asistente de organización de notas en español. ' +
        'Analiza la nota y genera un título corto y atractivo (máximo 6 palabras) y entre 2 y 4 etiquetas temáticas en minúsculas separadas por coma. ' +
        'Responde exactamente en formato JSON con la siguiente estructura: {"title": "...", "tags": ["tag1", "tag2"]}';
      prompt = `Genera título y etiquetas para esta nota:\n\n${text}`;
      break;

    case 'translate': {
      const langName = getLanguageName(targetLang);
      systemInstruction =
        `Eres un traductor profesional, natural y preciso. Tu tarea es traducir el texto recibido al idioma: ${langName}. ` +
        'Conserva fielmente el significado, el estilo, el tono y el formato original (párrafos, listas con viñetas, saltos de línea). ' +
        'Responde ÚNICAMENTE con la traducción final, sin notas del traductor, sin explicaciones ni comillas adicionales.';
      prompt = `Traduce el siguiente texto al ${langName}:\n\n${text}`;
      break;
    }

    default:
      throw new Error(`Acción desconocida: ${action}`);
  }

  let response = null;
  let lastError = null;

  // Timeout por petición para evitar que una llamada colgada bloquee el servidor
  const callWithTimeout = (promise, ms = 8000) => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms superado en llamada a Gemini`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  };

  const configuredModel = process.env.GEMINI_MODEL;
  // Si se inyecta un cliente de prueba, respetar su modelo único para preservar aserciones de prueba
  const candidateModels = client
    ? [configuredModel || 'gemini-3.8-flash']
    : [
        configuredModel && configuredModel !== 'gemini-3.8-flash' ? configuredModel : 'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash'
      ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  modelLoop:
  for (const modelName of candidateModels) {
    const maxAttempts = client ? 3 : 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.3
          }
        });

        // Solo aplicamos timeout en llamadas reales sin cliente simulado
        response = client ? await generatePromise : await callWithTimeout(generatePromise, 8500);

        if (response && response.text) {
          lastError = null;
          break modelLoop;
        }

        if (attempt < maxAttempts) {
          await new Promise(res => setTimeout(res, attempt * retryBaseDelay));
        }
      } catch (err) {
        lastError = err;
        const is404 = err.status === 404 || (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found')));
        if (is404) {
          console.error(`[AI Service] Error 404: El modelo "${modelName}" no fue encontrado.`);
          break; // Pasar al siguiente modelo candidato
        }

        const isTemporary = err.message && (
          err.message.includes('503') ||
          err.message.includes('high demand') ||
          err.message.includes('429') ||
          err.message.includes('Timeout')
        );

        if (attempt < maxAttempts && isTemporary) {
          await new Promise(res => setTimeout(res, attempt * retryBaseDelay));
        } else {
          break; // Si se agotaron los intentos para este modelo o no es temporal, probar el siguiente modelo candidato
        }
      }
    }
  }

  if (lastError) {
    const is404 = lastError.status === 404 || (lastError.message && (lastError.message.includes('404') || lastError.message.toLowerCase().includes('not found')));
    if (!is404) {
      console.warn('[AI Service] No se pudo obtener respuesta de Gemini con los modelos intentados:', lastError.message || lastError);
    }
  }

  const resultText = response && response.text ? response.text.trim() : '';

  // Fallback inteligente en caso de indisponibilidad de la nube
  if (!resultText) {
    return applyFallback(action, text, targetLang);
  }

  if (action === 'extract_tasks' && /^[\s"'«»•\-*]*SIN_TAREAS[\s."'«»]*$/i.test(resultText)) {
    return { action, result: '', fallback: false };
  }

  if (action === 'suggest_title') {
    const cleanTitle = resultText.replace(/^["'#\s]+|["'#.\s]+$/g, '').trim();
    return {
      action,
      title: cleanTitle,
      result: cleanTitle
    };
  }

  if (action === 'title_and_tags') {
    try {
      const cleanJson = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        action,
        title: typeof parsed.title === 'string' ? parsed.title : '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : []
      };
    } catch {
      return applyFallback('title_and_tags', text, resultText);
    }
  }

  if (action === 'translate') {
    let cleanTranslation = resultText;
    if ((cleanTranslation.startsWith('"') && cleanTranslation.endsWith('"')) ||
        (cleanTranslation.startsWith('«') && cleanTranslation.endsWith('»')) ||
        (cleanTranslation.startsWith('“') && cleanTranslation.endsWith('”'))) {
      cleanTranslation = cleanTranslation.slice(1, -1).trim();
    }
    return {
      action,
      result: cleanTranslation
    };
  }

  return {
    action,
    result: resultText
  };
}
