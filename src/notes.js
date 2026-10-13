import { state, el, notesCache } from './state.js';
import { uid, formatDate, escapeHtml, colorForNewFolder } from './utils.js';
import { loadNotes, persistNotes, persistFolders, storageDelete, storageGet, storageSet, updateStorageUsageUI } from './storage.js';
import { askConfirm, setStatus, closeSidebar, setMobileTab, shareToWhatsApp } from './ui.js';
import { sendNoteToTrash } from './trash.js';
import { speak } from './tts.js';
import { renderFolders, hideFolderPreview } from './render-folders.js';
import { renderNotes, getNotePreview, openQuickPreview } from './render-notes.js';

// ---------- BÚSQUEDA GLOBAL EN TODAS LAS CARPETAS ----------
let searchToken = 0;
export async function renderGlobalSearchResults(query){
  const myToken = ++searchToken;
  el.notesCount.textContent = 'Buscando…';
  el.notesList.innerHTML = `<div class="empty-state"><div class="glyph">🔍</div><p>Buscando en todas las carpetas…</p></div>`;

  const q = query.toLowerCase();
  const results = [];
  for(const folder of state.folders){
    let notes = notesCache[folder.id];
    if(!notes){ notes = await loadNotes(folder.id); }
    notes.forEach(n => {
      if(n.text.toLowerCase().includes(q)){
        results.push({ note: n, folder });
      }
    });
  }
  if(myToken !== searchToken) return; // el usuario ya cambió la búsqueda, descarta este resultado

  results.sort((a,b) => (b.note.pinned - a.note.pinned) || (b.note.createdAt - a.note.createdAt));
  el.notesCount.textContent = results.length + (results.length === 1 ? ' resultado' : ' resultados');
  if(el.mobileNotesBadge){
    el.mobileNotesBadge.textContent = results.length;
  }

  if(results.length === 0){
    el.notesList.innerHTML = `<div class="empty-state"><div class="glyph">🔍</div><p>Sin resultados en ninguna carpeta.</p></div>`;
    return;
  }

  const isCompact = state.viewMode === 'compact';
  el.notesList.innerHTML = '';
  results.forEach(({note: n, folder}) => {
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
          <span class="search-folder-badge">📁 ${escapeHtml(folder.name)}</span>
          ${n.pinned ? '<span class="pinned-badge">📌 Fijada</span>' : ''}
          ${isCurrent ? '<span class="active-badge">✏️ En editor</span>' : ''}
          <span class="note-date">📅 ${formatDate(n.createdAt)}</span>
          <span class="note-stats-pill">⏱️ ${prev.words} pal · ${prev.readTime}</span>
        </div>
        <div class="note-actions">
          <button class="icon-btn" title="Vista previa completa" data-act="preview">👁️</button>
          <button class="icon-btn" title="Compartir en WhatsApp" data-act="whatsapp">💬</button>
          <button class="icon-btn" title="Leer en voz alta" data-act="play">🔊</button>
        </div>
      </div>
      <div class="note-preview-content">
        <h4 class="note-preview-title">${escapeHtml(prev.title)}</h4>
        ${prev.body ? `<div class="note-preview-body">${escapeHtml(prev.body)}</div>` : ''}
      </div>
    `;

    card.addEventListener('click', async (e) => {
      const actBtn = e.target.closest('[data-act]');
      const act = actBtn ? actBtn.getAttribute('data-act') : null;
      if(act === 'preview'){ e.stopPropagation(); openQuickPreview(n, folder.name); return; }
      if(act === 'whatsapp'){ e.stopPropagation(); shareToWhatsApp(n.text, n.title); return; }
      if(act === 'play'){ e.stopPropagation(); speak(n.text); return; }
      state.searchQuery = '';
      state.searchGlobal = false;
      el.searchInput.value = '';
      if(el.searchClearBtn) el.searchClearBtn.style.display = 'none';
      el.searchGlobalCheckbox.checked = false;
      await selectFolder(folder.id);
      loadNoteIntoEditor(n);
    });
    el.notesList.appendChild(card);
  });
}

export async function toggleImportant(id){
  const note = state.notes.find(n => n.id === id);
  if(!note) return;
  note.pinned = !note.pinned;
  await persistNotes(state.activeFolderId, state.notes);
  renderNotes();
  setStatus(note.pinned ? 'Nota fijada arriba.' : 'Nota ya no está fijada.');
}

// ---------- MOVER NOTA A OTRA CARPETA ----------
let moveMenuHideTimer = null;

export function openMoveMenu(anchorEl, noteId, sourceFolderId){
  clearTimeout(moveMenuHideTimer);
  const others = state.folders.filter(f => f.id !== sourceFolderId);
  const label = `<div class="move-menu-label">Mover a…</div>`;
  if(others.length === 0){
    el.moveMenu.innerHTML = label + `<div class="move-menu-empty">No hay otra carpeta disponible.</div>`;
  } else {
    el.moveMenu.innerHTML = label + others.map(f => `
      <div class="move-menu-item" data-folder-id="${f.id}">
        ${f.color ? `<span class="folder-dot" style="background:${f.color}"></span>` : '📁'} ${escapeHtml(f.name)}
      </div>
    `).join('');
    el.moveMenu.querySelectorAll('.move-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        moveNoteToFolder(noteId, sourceFolderId, item.getAttribute('data-folder-id'));
        closeMoveMenu();
      });
    });
  }

  const rect = anchorEl.getBoundingClientRect();
  let left = rect.left;
  if(left + 240 > window.innerWidth) left = window.innerWidth - 250;
  el.moveMenu.style.left = Math.max(10, left) + 'px';
  el.moveMenu.style.top = (rect.bottom + 6) + 'px';
  el.moveMenu.classList.add('open');

  document.addEventListener('click', outsideMoveMenuClick, { once: false });
}

export function outsideMoveMenuClick(e){
  if(!el.moveMenu.contains(e.target) && !e.target.closest('[data-act="move"]')){
    closeMoveMenu();
  }
}

export function closeMoveMenu(){
  el.moveMenu.classList.remove('open');
  document.removeEventListener('click', outsideMoveMenuClick);
}

export async function moveNoteToFolder(noteId, sourceFolderId, targetFolderId){
  if(!targetFolderId || targetFolderId === sourceFolderId) return;
  const sourceNotes = sourceFolderId === state.activeFolderId ? state.notes : (notesCache[sourceFolderId] || await loadNotes(sourceFolderId));
  const idx = sourceNotes.findIndex(n => n.id === noteId);
  if(idx === -1) return;
  const [note] = sourceNotes.splice(idx, 1);
  await persistNotes(sourceFolderId, sourceNotes);

  const targetNotes = notesCache[targetFolderId] || await loadNotes(targetFolderId);
  targetNotes.push(note);
  await persistNotes(targetFolderId, targetNotes);

  if(sourceFolderId === state.activeFolderId){ state.notes = sourceNotes; }
  renderNotes();
  renderFolders();
  const targetFolder = state.folders.find(f => f.id === targetFolderId);
  setStatus(`Nota movida a «${targetFolder ? targetFolder.name : ''}».`);
}

// ---------- FOLDER ACTIONS ----------
export async function selectFolder(id){
  if(autoSaveTimeout){
    clearTimeout(autoSaveTimeout);
    await autoSaveDraft();
  }
  state.activeFolderId = id;
  state.currentNoteId = null;
  el.editor.value = '';
  hideFolderPreview();
  closeSidebar();
  const f = state.folders.find(x => x.id === id);
  el.folderTitle.textContent = f ? f.name : '';
  renderFolders();
  setStatus('Cargando…');
  state.notes = await loadNotes(id);
  renderNotes();
  setStatus('');
}

export async function addFolder(){
  const name = el.newFolderInput.value.trim();
  if(!name){
    setStatus('Escribe un nombre para la nueva carpeta.', true);
    el.newFolderInput.focus();
    return;
  }
  const color = colorForNewFolder(name, state.folders);
  const folder = { id: uid(), name, createdAt: Date.now(), color };
  state.folders.push(folder);
  await persistFolders();
  el.newFolderInput.value = '';
  renderFolders();
  selectFolder(folder.id);
  setStatus(color ? 'Carpeta creada con un color distinto para diferenciarla.' : 'Carpeta creada.');
}

export async function deleteFolder(id){
  if(state.folders.length <= 1){
    setStatus('Debe quedar al menos una carpeta.', true);
    return;
  }
  const f = state.folders.find(x => x.id === id);
  const ok = await askConfirm('Eliminar carpeta', `Se eliminará "${f ? f.name : ''}" y sus notas pasarán a la papelera. Podrás recuperarlas desde ahí.`);
  if(!ok) return;

  const notesInFolder = notesCache[id] || await loadNotes(id);
  for(const n of notesInFolder){
    await sendNoteToTrash(n, id, f ? f.name : 'Carpeta eliminada');
  }

  state.folders = state.folders.filter(x => x.id !== id);
  await persistFolders();
  await storageDelete('notes:' + id);
  delete notesCache[id];
  if(state.activeFolderId === id){
    await selectFolder(state.folders[0].id);
  } else {
    renderFolders();
  }
  setStatus('Carpeta eliminada. Sus notas quedaron en la papelera.');
}

// ---------- NOTE ACTIONS & AUTOSAVE ----------
let autoSaveTimeout = null;

export function cancelAutoSaveTimer(){
  if(autoSaveTimeout){
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
}

export function flushAutoSaveDraft(){
  if(autoSaveTimeout){
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
    autoSaveDraft();
  }
}

export function updateAutoSaveUI(enabled){
  state.autoSave = enabled;
  if(el.autoSaveCheckbox){
    el.autoSaveCheckbox.checked = enabled;
  }
}

export async function setAutoSave(enabled, notify = true){
  updateAutoSaveUI(enabled);
  if(!enabled && autoSaveTimeout){
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  await storageSet('autoSave', enabled ? 'true' : 'false');
  if(notify){
    setStatus(enabled ? 'Guardado automático activado ✓' : 'Guardado automático desactivado ⏸');
  }
}

export async function initAutoSave(){
  const saved = await storageGet('autoSave');
  const enabled = (saved === null || saved === 'true');
  updateAutoSaveUI(enabled);
}

export function triggerAutoSave(){
  if(!state.autoSave) return;
  if(autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    await autoSaveDraft();
  }, 700);
}

export async function autoSaveDraft(){
  const text = el.editor.value.trim();
  const title = el.noteTitleInput ? el.noteTitleInput.value.trim() : '';
  if(!text && !title) return;

  if(state.currentNoteId){
    const idx = state.notes.findIndex(n => n.id === state.currentNoteId);
    if(idx !== -1){
      const current = state.notes[idx];
      if(current.text === text && (current.title || '') === title){
        return;
      }
      current.title = title;
      current.text = text;
      current.updatedAt = Date.now();
    }
  } else {
    const note = { id: uid(), title, text, createdAt: Date.now(), pinned: false };
    state.notes.unshift(note);
    state.currentNoteId = note.id;
  }
  await persistNotes(state.activeFolderId, state.notes);
  renderNotes();
  renderFolders();
  setStatus('Guardado automático ✓');
}

export async function saveNote(){
  if(autoSaveTimeout) clearTimeout(autoSaveTimeout);
  const text = el.editor.value.trim();
  const title = el.noteTitleInput ? el.noteTitleInput.value.trim() : '';
  if(!text && !title){
    setStatus('Escribe un título o contenido antes de guardar.', true);
    if(el.editor) el.editor.focus();
    return;
  }

  if(state.currentNoteId){
    const idx = state.notes.findIndex(n => n.id === state.currentNoteId);
    if(idx !== -1){
      state.notes[idx].title = title;
      state.notes[idx].text = text;
      state.notes[idx].updatedAt = Date.now();
    }
  } else {
    const note = { id: uid(), title, text, createdAt: Date.now(), pinned: false };
    state.notes.unshift(note);
    state.currentNoteId = note.id;
  }
  await persistNotes(state.activeFolderId, state.notes);
  renderNotes();
  renderFolders();
  setStatus('Nota guardada ✓');
}

export function loadNoteIntoEditor(note){
  state.currentNoteId = note.id;
  if(el.noteTitleInput){
    el.noteTitleInput.value = note.title || '';
  }
  el.editor.value = note.text || '';
  if(window.innerWidth <= 860){
    setMobileTab('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  el.editor.focus();
}

export async function deleteNote(id){
  const ok = await askConfirm('Eliminar nota', 'La nota se moverá a la papelera. Podrás recuperarla desde ahí durante 30 días.');
  if(!ok) return;
  const note = state.notes.find(n => n.id === id);
  const folder = state.folders.find(f => f.id === state.activeFolderId);
  state.notes = state.notes.filter(n => n.id !== id);
  await persistNotes(state.activeFolderId, state.notes);
  if(note){
    await sendNoteToTrash(note, state.activeFolderId, folder ? folder.name : '');
  }
  if(state.currentNoteId === id){
    state.currentNoteId = null;
    el.editor.value = '';
  }
  renderNotes();
  renderFolders();
  setStatus('Nota movida a la papelera.');
}

// Modo de visualización de notas (Previa vs Lista)
export function setViewMode(mode){
  state.viewMode = mode;
  if(mode === 'compact'){
    if(el.viewModeCompactBtn) el.viewModeCompactBtn.classList.add('active');
    if(el.viewModeDetailedBtn) el.viewModeDetailedBtn.classList.remove('active');
  } else {
    if(el.viewModeDetailedBtn) el.viewModeDetailedBtn.classList.add('active');
    if(el.viewModeCompactBtn) el.viewModeCompactBtn.classList.remove('active');
  }
  renderNotes();
}

// ---------- MODAL DE CONFIGURACIÓN (Voz y Guardado) ----------
export function openSettingsModal(){
  updateStorageUsageUI();
  if(el.settingsOverlay){
    el.settingsOverlay.classList.add('open');
  }
}

export function closeSettingsModal(){
  if(el.settingsOverlay){
    el.settingsOverlay.classList.remove('open');
  }
}
