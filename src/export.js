import { formatDate, escapeHtml } from './utils.js';
import { TASK_REGEX } from './tasks.js';

// ---------- EXPORTACIÓN INDIVIDUAL DE NOTAS ----------

/**
 * Sanitiza un string para que sea seguro como nombre de archivo
 */
function sanitizeFileName(name) {
  const clean = (name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  return clean || 'nota';
}

/**
 * Descarga un archivo Blob en el navegador
 */
function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

/**
 * Exporta la nota como archivo de texto plano (.txt)
 */
export function exportAsTxt(note, folderName = 'General') {
  if (!note) return;
  const title = (note.title || '').trim();
  const text = (note.text || '').trim();
  const dateStr = formatDate(note.createdAt || Date.now());

  let content = '';
  if (title) {
    content += `${title}\n${'='.repeat(Math.max(title.length, 20))}\n\n`;
  }
  content += `Carpeta: ${folderName}\n`;
  content += `Fecha: ${dateStr}\n\n`;
  content += `${text}\n`;

  const fileName = `${sanitizeFileName(title || 'nota')}.txt`;
  triggerDownload(content, fileName, 'text/plain;charset=utf-8');
}

/**
 * Exporta la nota como archivo Markdown (.md)
 */
export function exportAsMarkdown(note, folderName = 'General') {
  if (!note) return;
  const title = (note.title || '').trim() || 'Nota sin título';
  const text = (note.text || '').trim();
  const dateStr = formatDate(note.createdAt || Date.now());

  let content = `# ${title}\n\n`;
  content += `> **Carpeta:** ${folderName} | **Fecha:** ${dateStr}\n\n`;
  content += `---\n\n`;
  content += `${text}\n`;

  const fileName = `${sanitizeFileName(title)}.md`;
  triggerDownload(content, fileName, 'text/markdown;charset=utf-8');
}

/**
 * Prepara la nota para imprimir y dispara la ventana de impresión para guardar como PDF
 */
export function printNoteToPdf(note, folderName = 'General') {
  if (!note) return;
  const title = (note.title || '').trim() || 'Nota sin título';
  const text = (note.text || '').trim();
  const dateStr = formatDate(note.createdAt || Date.now());

  let printContainer = document.getElementById('printContainer');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'printContainer';
    printContainer.className = 'print-container';
    document.body.appendChild(printContainer);
  }

  // Formatear líneas del cuerpo (incluyendo tareas si las hay)
  const lines = text.split(/\r?\n/);
  const formattedBody = lines.map(line => {
    const match = line.match(TASK_REGEX);
    if (match) {
      const isChecked = match[2].toLowerCase() === 'x';
      const content = escapeHtml(match[3] || '');
      return `
        <div class="print-task-item ${isChecked ? 'completed' : ''}">
          <span class="print-task-box">${isChecked ? '✓' : ''}</span>
          <span class="print-task-label">${content}</span>
        </div>
      `;
    }
    if (!line.trim()) {
      return '<div class="print-spacer"></div>';
    }
    return `<p class="print-paragraph">${escapeHtml(line)}</p>`;
  }).join('');

  printContainer.innerHTML = `
    <div class="print-header">
      <div class="print-brand">
        <span class="print-brand-mark">●</span>
        <span>Bitácora Hablada</span>
      </div>
      <div class="print-folder-badge">📁 ${escapeHtml(folderName)}</div>
    </div>

    <h1 class="print-title">${escapeHtml(title)}</h1>

    <div class="print-meta">
      <span>📅 ${dateStr}</span>
    </div>

    <hr class="print-divider">

    <div class="print-body">
      ${formattedBody || '<p><em>Nota vacía</em></p>'}
    </div>

    <div class="print-footer">
      <span>Generado con Bitácora Hablada · www</span>
    </div>
  `;

  // Disparar ventana de impresión nativa del navegador
  window.print();
}
