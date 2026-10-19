import { escapeHtml } from './utils.js';

// ---------- MANEJO DE TAREAS INTERACTIVAS (CHECKBOXES) ----------

// Expresión regular para detectar casillas de tareas [ ] y [x]
export const TASK_REGEX = /^(\s*)(?:[-*]\s*)?\[([ xX])\]\s*(.*)$/;

/**
 * Determina si un texto contiene al menos una tarea [ ] o [x]
 */
export function hasTasks(text) {
  if (!text) return false;
  return /(?:^|\n)\s*(?:[-*]\s*)?\[([ xX])\]/m.test(text);
}

/**
 * Calcula estadísticas de tareas (total, completadas, porcentaje)
 */
export function getTaskStats(text) {
  if (!text) return { total: 0, completed: 0, percent: 0 };
  const lines = text.split(/\r?\n/);
  let total = 0;
  let completed = 0;

  for (const line of lines) {
    const match = line.match(TASK_REGEX);
    if (match) {
      total++;
      if (match[2].toLowerCase() === 'x') {
        completed++;
      }
    }
  }

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}

/**
 * Alterna el estado de una tarea específica en el texto de una nota
 * @param {string} fullText Texto completo de la nota
 * @param {number} taskIndex Índice (0-based) de la tarea a alternar
 * @returns {string} Texto actualizado con la casilla invertida
 */
export function toggleTaskByIndex(fullText, taskIndex) {
  if (!fullText) return fullText;
  const lines = fullText.split(/\r?\n/);
  let currentTaskIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_REGEX);
    if (match) {
      if (currentTaskIdx === taskIndex) {
        const indent = match[1] || '';
        const isChecked = match[2].toLowerCase() === 'x';
        const newMark = isChecked ? ' ' : 'x';
        const rest = match[3];
        lines[i] = `${indent}[${newMark}] ${rest}`;
        break;
      }
      currentTaskIdx++;
    }
  }

  return lines.join('\n');
}

/**
 * Inserta o alterna una casilla de tarea [ ] en la línea actual del editor
 */
export function toggleTaskInEditor(textarea) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  // Encontrar el inicio y final de las líneas seleccionadas
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = val.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = val.length;

  const selectedText = val.slice(lineStart, lineEnd);
  const lines = selectedText.split('\n');

  const newLines = lines.map(line => {
    const match = line.match(TASK_REGEX);
    if (match) {
      const indent = match[1] || '';
      const isChecked = match[2].toLowerCase() === 'x';
      const rest = match[3];
      // Si está marcada [x], quitar el formato de tarea
      if (isChecked) {
        return indent + rest;
      }
      // Si está desmarcada [ ], pasar a marcada [x]
      return `${indent}[x] ${rest}`;
    }
    // Si tiene viñeta común (- o * o •)
    if (/^\s*[-*•]\s+/.test(line)) {
      return line.replace(/^(\s*)[-*•]\s+/, '$1[ ] ');
    }
    // Si no tiene prefijo, agregar [ ]
    return `[ ] ${line}`;
  });

  const replacement = newLines.join('\n');
  textarea.value = val.slice(0, lineStart) + replacement + val.slice(lineEnd);

  // Reposicionar el cursor
  const newCursor = lineStart + replacement.length;
  textarea.setSelectionRange(newCursor, newCursor);
  textarea.focus();

  // Disparar evento input para sincronizar guardado
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Maneja la pulsación de la tecla Enter en el textarea para continuar listas de tareas
 */
export function handleTaskEnterKey(e, textarea) {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }

  const start = textarea.selectionStart;
  const val = textarea.value;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const currentLine = val.slice(lineStart, start);

  const match = currentLine.match(TASK_REGEX);
  if (match) {
    const indent = match[1] || '';
    const taskContent = match[3].trim();

    // Si la línea de tarea está vacía "[ ] ", borrar el prefijo y salir de la lista
    if (!taskContent) {
      e.preventDefault();
      textarea.value = val.slice(0, lineStart) + val.slice(start);
      textarea.setSelectionRange(lineStart, lineStart);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // Si tiene contenido, crear una nueva línea con una casilla vacía
    e.preventDefault();
    const insert = `\n${indent}[ ] `;
    textarea.value = val.slice(0, start) + insert + val.slice(textarea.selectionEnd);
    const newPos = start + insert.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Convierte el texto de una nota en HTML con casillas interactivas
 * @param {string} text Texto de la nota
 * @param {Function} onToggle Callback cuando el usuario hace clic en una casilla
 */
export function renderInteractiveTasksHtml(text, _onToggleCallback) {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  let taskIndex = 0;

  const htmlLines = lines.map(line => {
    const match = line.match(TASK_REGEX);
    if (match) {
      const idx = taskIndex++;
      const isChecked = match[2].toLowerCase() === 'x';
      const content = escapeHtml(match[3] || '');
      return `<div class="task-item-row" data-task-idx="${idx}">
        <input type="checkbox" class="task-checkbox" id="task-chk-${idx}" ${isChecked ? 'checked' : ''} aria-label="Marcar tarea">
        <label for="task-chk-${idx}" class="task-label ${isChecked ? 'completed' : ''}">${content || '<em>(Tarea vacía)</em>'}</label>
      </div>`;
    }
    // Línea de texto normal
    if (!line.trim()) {
      return '<div class="text-empty-line">&nbsp;</div>';
    }
    return `<div class="text-line">${escapeHtml(line)}</div>`;
  });

  return htmlLines.join('');
}
