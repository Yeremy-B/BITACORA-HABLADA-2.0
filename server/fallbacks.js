/**
 * Funciones de fallback local cuando la API de IA no está disponible o no devuelve texto.
 * Permite que Bitácora Hablada funcione offline y de manera resiliente.
 */

export function fallbackFormatDictation(text) {
  let formatted = (text || '').trim();
  if (!formatted) return '';
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  if (!/[.!?]$/.test(formatted)) formatted += '.';
  return formatted;
}

export function fallbackSuggestTitle(text) {
  const clean = (text || '').trim();
  if (!clean) return '';
  const firstLine = clean.split('\n').map(l => l.replace(/^[#\-*\s]+/, '').trim()).find(l => l.length > 0) || clean;
  const words = firstLine.split(/\s+/).slice(0, 6).join(' ');
  const title = words.length > 40 ? words.slice(0, 40) + '…' : words;
  return title.replace(/^["'#\s]+|["'\s]+$/g, '').trim();
}

export function fallbackSummarize(text) {
  const clean = (text || '').trim();
  if (!clean) return '';
  const sentences = clean.split(/[.\n]+/).map(s => s.trim()).filter(Boolean);
  return sentences.slice(0, 3).map(s => `• ${s}`).join('\n');
}

export function fallbackExtractTasks(text) {
  const clean = (text || '').trim();
  if (!clean) return '';
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const tasks = lines.filter(l => /hacer|comprar|llamar|enviar|revisar|pendiente|tarea|ir a|pagar/i.test(l));
  return tasks.length > 0
    ? tasks.map(t => `• ${t.replace(/^[•\-\s]+/, '')}`).join('\n')
    : '';
}

export function fallbackTitleAndTags(text, rawText = '') {
  let title = '';
  let tags = [];
  if (rawText) {
    try {
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed.title === 'string') title = parsed.title;
      if (Array.isArray(parsed.tags)) tags = parsed.tags;
    } catch {
      title = '';
      tags = [];
    }
  }
  return {
    action: 'title_and_tags',
    title,
    tags,
    fallback: true
  };
}

export function applyFallback(action, text, rawText = '') {
  switch (action) {
    case 'suggest_title': {
      const title = fallbackSuggestTitle(text);
      return {
        action,
        title,
        result: title,
        fallback: true
      };
    }
    case 'format_dictation': {
      const result = fallbackFormatDictation(text);
      return {
        action,
        result,
        fallback: true
      };
    }
    case 'summarize': {
      const result = fallbackSummarize(text);
      return {
        action,
        result,
        fallback: true
      };
    }
    case 'extract_tasks': {
      const result = fallbackExtractTasks(text);
      return {
        action,
        result,
        fallback: true
      };
    }
    case 'title_and_tags': {
      return fallbackTitleAndTags(text, rawText);
    }
    default:
      return {
        action,
        result: '',
        fallback: true
      };
  }
}
