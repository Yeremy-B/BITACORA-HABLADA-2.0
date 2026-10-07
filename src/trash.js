import { state, el, notesCache } from './state.js';
import { uid, formatDate, escapeHtml, normalizeName, colorForNewFolder } from './utils.js';
import { storageGet, storageSet, loadNotes, persistNotes, persistFolders } from './storage.js';
import { askConfirm, setStatus } from './ui.js';
import { renderFolders, renderNotes } from './notes.js';

// ---------- PAPELERA ----------
export const TRASH_MAX_DAYS = 30;
let trashItems = [];

export async function loadTrash(){
  const raw = await storageGet('trash');
  let items = [];
  if(raw){
    try{ items = JSON.parse(raw); }catch(e){ items = []; }
  }
  const cutoff = Date.now() - TRASH_MAX_DAYS * 24 * 60 * 60 * 1000;
  const kept = items.filter(it => it.deletedAt > cutoff);
  if(kept.length !== items.length){
    await storageSet('trash', JSON.stringify(kept));
  }
  trashItems = kept;
  updateTrashCount();
  return trashItems;
}

export async function persistTrash(){
  await storageSet('trash', JSON.stringify(trashItems));
  updateTrashCount();
}

export function updateTrashCount(){
  el.trashCount.textContent = trashItems.length ? `(${trashItems.length})` : '';
}

export async function sendNoteToTrash(note, folderId, folderName){
  trashItems.unshift({
    trashId: uid(),
    note: note,
    folderId: folderId,
    folderName: folderName,
    deletedAt: Date.now()
  });
  await persistTrash();
}

export function renderTrash(){
  if(trashItems.length === 0){
    el.trashList.innerHTML = `<div class="trash-empty">La papelera está vacía.</div>`;
    return;
  }
  el.trashList.innerHTML = '';
  trashItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'trash-item';
    row.innerHTML = `
      <div class="trash-item-info">
        <div class="trash-item-meta">de «${escapeHtml(item.folderName)}» · eliminada ${formatDate(item.deletedAt)}</div>
        <div class="trash-item-text">${escapeHtml(item.note.text)}</div>
      </div>
      <div class="trash-item-actions">
        <button class="restore-btn" data-act="restore">↩ Restaurar</button>
        <button class="forget-btn" data-act="forget">Borrar ya</button>
      </div>
    `;
    row.querySelector('[data-act="restore"]').addEventListener('click', () => restoreTrashItem(item.trashId));
    row.querySelector('[data-act="forget"]').addEventListener('click', () => forgetTrashItem(item.trashId));
    el.trashList.appendChild(row);
  });
}

export async function openTrash(){
  await loadTrash();
  renderTrash();
  el.trashOverlay.classList.add('open');
}

export function closeTrash(){
  el.trashOverlay.classList.remove('open');
}

export async function restoreTrashItem(trashId){
  const item = trashItems.find(it => it.trashId === trashId);
  if(!item) return;

  let targetFolder = state.folders.find(f => f.id === item.folderId);
  if(!targetFolder){
    // La carpeta original ya no existe: se recrea (o se reutiliza una con el mismo nombre)
    targetFolder = state.folders.find(f => normalizeName(f.name) === normalizeName(item.folderName));
    if(!targetFolder){
      const color = colorForNewFolder(item.folderName, state.folders);
      targetFolder = { id: uid(), name: item.folderName, createdAt: Date.now(), color };
      state.folders.push(targetFolder);
      await persistFolders();
      renderFolders();
    }
  }

  const targetNotes = notesCache[targetFolder.id] || await loadNotes(targetFolder.id);
  const restoredNote = { ...item.note };
  targetNotes.push(restoredNote);
  await persistNotes(targetFolder.id, targetNotes);

  trashItems = trashItems.filter(it => it.trashId !== trashId);
  await persistTrash();
  renderTrash();

  if(targetFolder.id === state.activeFolderId){
    state.notes = targetNotes;
    renderNotes();
  }
  setStatus(`Nota restaurada en «${targetFolder.name}».`);
}

export async function forgetTrashItem(trashId){
  const ok = await askConfirm('Borrar para siempre', 'Esta nota se eliminará definitivamente y no se podrá recuperar.');
  if(!ok) return;
  trashItems = trashItems.filter(it => it.trashId !== trashId);
  await persistTrash();
  renderTrash();
}

export async function emptyTrash(){
  if(trashItems.length === 0) return;
  const ok = await askConfirm('Vaciar papelera', `Se eliminarán definitivamente ${trashItems.length} nota(s). Esta acción no se puede deshacer.`);
  if(!ok) return;
  trashItems = [];
  await persistTrash();
  renderTrash();
  setStatus('Papelera vaciada.');
}
