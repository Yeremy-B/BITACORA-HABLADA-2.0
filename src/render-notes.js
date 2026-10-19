import { state, el } from './state.js';
import { formatDate, escapeHtml } from './utils.js';
import { shareToWhatsApp, setStatus } from './ui.js';
import { speak } from './tts.js';
import { persistNotes } from './storage.js';
import {
  renderGlobalSearchResults,
  deleteNote,
  toggleImportant,
  openMoveMenu,
  loadNoteIntoEditor,
  updateEditorTasksBar
} from './notes.js';
import {
  getTaskStats,
  hasTasks,
  renderInteractiveTasksHtml,
  toggleTaskByIndex
} from './tasks.js';

// ---------- VISTA PREVIA Y ESTRUCTURA DE NOTAS ----------
export function getNotePreview(text, explicitTitle){
  const raw = (text || '').trim();
  const cleanTitle = (explicitTitle || '').trim();
  const words = raw.split(/\s+/).filter(Boolean).length;
  const chars = raw.length;
  const readSeconds = Math.max(1, Math.round(words / 3.2));
  const readTime = readSeconds < 60 ? `${readSeconds}s` : `${Math.ceil(readSeconds / 60)} min`;
  const taskStats = getTaskStats(raw);

  if(cleanTitle){
    return {
      title: cleanTitle,
      body: raw,
      words,
      chars,
      readTime,
      taskStats
    };
  }

  if(!raw){
    return {
      title: 'Nota sin contenido',
      body: '',
      words: 0,
      chars: 0,
      readTime: '0s'
    };
  }
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let title = lines[0] || 'Nota sin título';
  let body = '';

  if(lines.length > 1){
    body = lines.slice(1).join('\n');
  } else {
    if(title.length > 65){
      const punctIdx = title.search(/[.!?]\s+/);
      if(punctIdx > 12 && punctIdx < 65){
        body = title.slice(punctIdx + 1).trim();
        title = title.slice(0, punctIdx + 1);
      }
    }
  }

  return { title, body, words, chars, readTime, taskStats };
}

let currentPreviewNote = null;
let currentPreviewFolder = null;

export function getCurrentPreviewNote(){
  return currentPreviewNote;
}

export function getCurrentPreviewFolder(){
  return currentPreviewFolder;
}

export function openQuickPreview(note, folderName){
  currentPreviewNote = note;
  currentPreviewFolder = folderName || (state.folders.find(f => f.id === state.activeFolderId)?.name || 'General');
  const prev = getNotePreview(note.text, note.title);

  let badgesHtml = '';
  if(note.pinned){
    badgesHtml += '<span class="pinned-badge">📌 Fijada</span>';
  }
  if(note.id === state.currentNoteId){
    badgesHtml += '<span class="active-badge">✏️ En editor</span>';
  }
  if(prev.taskStats && prev.taskStats.total > 0){
    badgesHtml += `<span class="note-tasks-pill ${prev.taskStats.completed === prev.taskStats.total ? 'all-done' : ''}">☑️ ${prev.taskStats.completed}/${prev.taskStats.total} tareas (${prev.taskStats.percent}%)</span>`;
  }
  badgesHtml += `<span class="note-stats-pill" title="${prev.words} palabras, ${prev.chars} caracteres">⏱️ ${prev.words} palabras · ${prev.chars} caracteres · ~${prev.readTime} de lectura</span>`;
  el.quickPreviewBadges.innerHTML = badgesHtml;

  el.quickPreviewTitle.textContent = prev.title;
  el.quickPreviewMeta.textContent = `📁 Carpeta: ${currentPreviewFolder} · 📅 ${formatDate(note.createdAt)}`;

  if(hasTasks(note.text)){
    el.quickPreviewContent.innerHTML = renderInteractiveTasksHtml(note.text);
    el.quickPreviewContent.querySelectorAll('.task-checkbox').forEach(chk => {
      chk.addEventListener('change', async () => {
        const row = chk.closest('.task-item-row');
        if(!row) return;
        const taskIdx = parseInt(row.getAttribute('data-task-idx'), 10);
        note.text = toggleTaskByIndex(note.text, taskIdx);
        await persistNotes(state.activeFolderId, state.notes);
        if(state.currentNoteId === note.id && el.editor){
          el.editor.value = note.text;
          updateEditorTasksBar();
        }
        renderNotes();
        openQuickPreview(note, currentPreviewFolder);
        setStatus('Tarea actualizada ✓');
      });
    });
  } else {
    el.quickPreviewContent.textContent = note.text;
  }

  el.quickPreviewOverlay.classList.add('open');
}

export function closeQuickPreview(){
  el.quickPreviewOverlay.classList.remove('open');
  currentPreviewNote = null;
  currentPreviewFolder = null;
}

// ---------- RENDER NOTES ----------
export function renderNotes(){
  // ---- modo búsqueda global (en todas las carpetas) ----
  if(state.searchGlobal && state.searchQuery.trim()){
    renderGlobalSearchResults(state.searchQuery.trim());
    return;
  }

  // ---- filtrar ----
  let list = state.notes;
  const q = state.searchQuery.trim().toLowerCase();
  if(q){
    list = list.filter(n => {
      const t = (n.text || '').toLowerCase();
      const tit = (n.title || '').toLowerCase();
      return t.includes(q) || tit.includes(q);
    });
  }

  el.notesCount.textContent = list.length + (list.length === 1 ? ' nota' : ' notas');
  if(el.mobileNotesBadge){
    el.mobileNotesBadge.textContent = state.notes.length;
  }

  if(list.length === 0){
    el.notesList.innerHTML = `
      <div class="empty-state">
        <div class="glyph">${q ? '🔍' : '🗒️'}</div>
        <p>${q ? 'Sin resultados para tu búsqueda.' : 'Aún no hay notas en esta carpeta.<br>Escribe algo y pulsa «Guardar nota».'}</p>
      </div>`;
    return;
  }

  // ---- ordenar ----
  const sortFn = {
    recientes: (a,b) => b.createdAt - a.createdAt,
    antiguas: (a,b) => a.createdAt - b.createdAt,
    alfabetico: (a,b) => {
      const titleA = (a.title || a.text || '').trim().toLowerCase();
      const titleB = (b.title || b.text || '').trim().toLowerCase();
      return titleA.localeCompare(titleB, 'es');
    }
  }[state.sortMode] || ((a,b) => b.createdAt - a.createdAt);

  const pinned = list.filter(n => n.pinned).sort(sortFn);
  const rest = list.filter(n => !n.pinned).sort(sortFn);
  const ordered = [...pinned, ...rest];

  const isCompact = state.viewMode === 'compact';
  el.notesList.innerHTML = '';

  ordered.forEach(n => {
    const card = document.createElement('div');
    const isCurrent = (n.id === state.currentNoteId);
    card.className = 'note-card' +
      (n.pinned ? ' pinned' : '') +
      (isCurrent ? ' active-in-editor' : '') +
      (isCompact ? ' compact-view' : '');
    card.setAttribute('data-note-id', n.id);

    const prev = getNotePreview(n.text, n.title);

    card.innerHTML = `
      <div class="note-card-top">
        <div class="note-card-badges">
          ${n.pinned ? '<span class="pinned-badge">📌 Fijada</span>' : ''}
          ${isCurrent ? '<span class="active-badge">✏️ En editor</span>' : ''}
          ${prev.taskStats && prev.taskStats.total > 0 ? `<span class="note-tasks-badge ${prev.taskStats.completed === prev.taskStats.total ? 'all-done' : ''}">☑️ ${prev.taskStats.completed}/${prev.taskStats.total}</span>` : ''}
          <span class="note-date">📅 ${formatDate(n.createdAt)}</span>
          <span class="note-stats-pill" title="${prev.words} palabras, ${prev.chars} caracteres">⏱️ ${prev.words} pal · ${prev.readTime}</span>
        </div>
        <div class="note-actions">
          <button class="icon-btn" type="button" title="Vista previa completa" aria-label="Vista previa completa" data-act="preview">👁️</button>
          <button class="icon-btn pin-btn${n.pinned ? ' active' : ''}" type="button" title="${n.pinned ? 'Quitar fijado' : 'Fijar arriba'}" aria-label="${n.pinned ? 'Quitar fijado' : 'Fijar nota arriba'}" data-act="pin">${n.pinned ? '📌' : '📍'}</button>
          <button class="icon-btn" type="button" title="Compartir en WhatsApp" aria-label="Compartir en WhatsApp" data-act="whatsapp">💬</button>
          <button class="icon-btn" type="button" title="Leer en voz alta" aria-label="Leer nota en voz alta" data-act="play">🔊</button>
          <button class="icon-btn" type="button" title="Mover a otra carpeta" aria-label="Mover a otra carpeta" data-act="move">📂</button>
          <button class="icon-btn danger" type="button" title="Eliminar nota" aria-label="Eliminar nota" data-act="del">🗑️</button>
        </div>
      </div>
      <div class="note-preview-content">
        <h4 class="note-preview-title">${escapeHtml(prev.title)}</h4>
        ${prev.body ? `<div class="note-preview-body">${escapeHtml(prev.body)}</div>` : ''}
      </div>
    `;

    card.addEventListener('click', (e) => {
      const actBtn = e.target.closest('[data-act]');
      const act = actBtn ? actBtn.getAttribute('data-act') : null;
      if(act === 'preview'){ e.stopPropagation(); openQuickPreview(n); return; }
      if(act === 'whatsapp'){ e.stopPropagation(); shareToWhatsApp(n.text, n.title); return; }
      if(act === 'play'){ e.stopPropagation(); speak(n.text); return; }
      if(act === 'del'){ e.stopPropagation(); deleteNote(n.id); return; }
      if(act === 'pin'){ e.stopPropagation(); toggleImportant(n.id); return; }
      if(act === 'move'){ e.stopPropagation(); openMoveMenu(actBtn || e.target, n.id, state.activeFolderId); return; }
      loadNoteIntoEditor(n);
    });
    el.notesList.appendChild(card);
  });
}
