import { GoogleGenAI } from '@google/genai';
import { applyFallback } from './fallbacks.js';

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

export async function processNoteWithAI(action, text) {
  if (!text || !text.trim()) {
    throw new Error('El texto de la nota está vacío.');
  }

  let ai;
  try {
    ai = getAIClient();
  } catch (err) {
    console.warn('[AI Service] API no disponible, aplicando fallback local:', err.message);
    return applyFallback(action, text);
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
        'Si la nota no contiene tareas explícitas, responde únicamente con una cadena vacía. ' +
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

    default:
      throw new Error(`Acción desconocida: ${action}`);
  }

  let response = null;
  let lastError = null;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  // Reintento automático con retroceso si la API devuelve 503 (alta demanda) o 429
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3
        }
      });
      if (response && response.text) {
        lastError = null;
        break;
      }
      // Si la respuesta llegó sin texto y sin error, esperar con retroceso antes de reintentar
      if (attempt < 3) {
        await new Promise(res => setTimeout(res, attempt * 600));
      }
    } catch (err) {
      lastError = err;
      const is404 = err.status === 404 || (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found')));
      if (is404) {
        console.error(`[AI Service] Error 404: El modelo "${modelName}" no fue encontrado. Revisa la variable de entorno GEMINI_MODEL.`);
        break;
      }

      const isTemporary = err.message && (err.message.includes('503') || err.message.includes('high demand') || err.message.includes('429'));
      if (attempt < 3 && isTemporary) {
        await new Promise(res => setTimeout(res, attempt * 600));
      } else if (!isTemporary) {
        break;
      }
    }
  }

  if (lastError) {
    const is404 = lastError.status === 404 || (lastError.message && (lastError.message.includes('404') || lastError.message.toLowerCase().includes('not found')));
    if (!is404) {
      console.warn('[AI Service] No se pudo obtener respuesta de Gemini:', lastError.message || lastError);
    }
  }

  const resultText = response && response.text ? response.text.trim() : '';

  // Fallback inteligente en caso de indisponibilidad de la nube
  if (!resultText) {
    return applyFallback(action, text);
  }

  if (action === 'suggest_title') {
    const cleanTitle = resultText.replace(/^["'#\s]+|["'\s]+$/g, '').trim();
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

  return {
    action,
    result: resultText
  };
}
