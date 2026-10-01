import { GoogleGenAI } from '@google/genai';

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

  const ai = getAIClient();

  let systemInstruction = '';
  let prompt = '';

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
        'Si la nota no contiene tareas explícitas, indica brevemente qué acciones potenciales se desprenden de ella. ' +
        'No agregues introducciones ni despedidas.';
      prompt = `Extrae las tareas pendientes de esta nota:\n\n${text}`;
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

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.3
    }
  });

  const resultText = response.text ? response.text.trim() : '';

  if (action === 'title_and_tags') {
    try {
      // Intenta extraer el JSON del texto resultante
      const cleanJson = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        action,
        title: parsed.title || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : []
      };
    } catch (e) {
      return {
        action,
        title: 'Nota sin título',
        tags: [],
        rawText: resultText
      };
    }
  }

  return {
    action,
    result: resultText
  };
}
