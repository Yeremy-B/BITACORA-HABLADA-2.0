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

  // Reintento automático con retroceso si la API devuelve 503 (alta demanda temporal)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3
        }
      });
      if (response && response.text) break;
    } catch (err) {
      lastError = err;
      const isTemporary = err.message && (err.message.includes('503') || err.message.includes('high demand') || err.message.includes('429'));
      if (attempt < 3 && isTemporary) {
        await new Promise(res => setTimeout(res, attempt * 600));
      } else if (!isTemporary) {
        break;
      }
    }
  }

  let resultText = response && response.text ? response.text.trim() : '';

  // Fallback inteligente en caso de indisponibilidad temporal de la nube
  if (!resultText) {
    if (action === 'suggest_title') {
      const firstLine = text.split('\n').map(l => l.replace(/^[#\-*\s]+/, '').trim()).find(l => l.length > 0) || text;
      const words = firstLine.split(/\s+/).slice(0, 6).join(' ');
      resultText = words.length > 40 ? words.slice(0, 40) + '…' : words;
    } else if (action === 'format_dictation') {
      // Puntuación básica de respaldo
      let formatted = text.trim();
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      if (!/[.!?]$/.test(formatted)) formatted += '.';
      resultText = formatted;
    } else if (action === 'summarize') {
      const sentences = text.split(/[.\n]+/).map(s => s.trim()).filter(Boolean);
      resultText = sentences.slice(0, 3).map(s => `• ${s}`).join('\n');
    } else if (action === 'extract_tasks') {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const tasks = lines.filter(l => /hacer|comprar|llamar|enviar|revisar|pendiente|tarea|ir a|pagar/i.test(l));
      resultText = tasks.length > 0
        ? tasks.map(t => `• ${t.replace(/^[•\-\s]+/, '')}`).join('\n')
        : '• ' + (lines[0] || 'Revisar notas pendientes');
    }
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
