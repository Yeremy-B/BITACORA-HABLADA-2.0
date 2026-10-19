import { state, el, notesCache } from './state.js';
import { formatDate, escapeHtml } from './utils.js';
import { loadNotes } from './storage.js';
import { selectFolder, deleteFolder, loadNoteIntoEditor } from './notes.js';
import { openEditFolderModal } from './folder-edit.js';

// ---------- RENDER FOLDERS ----------
const folderPreviewFlyout = document.getElementById('folderPreviewFlyout');
if(folderPreviewFlyout){
  folderPreviewFlyout.addEventListener('click', (e) => {
    const item = e.target.closest('.folder-preview-item');
    if(!item) return;
    const folderId = folderPreviewFlyout.getAttribute('data-folder-id');
    const notes = notesCache[folderId] || [];
    const note = notes.find(n => n.id === item.getAttribute('data-note-id'));
    if(note){
      if(folderId !== state.activeFolderId){ selectFolder(folderId); }
      loadNoteIntoEditor(note);
      hideFolderPreview();
    }
  });
  // Mantiene el flyout visible si el mouse entra en él directamente
  folderPreviewFlyout.addEventListener('mouseenter', () => folderPreviewFlyout.classList.add('open'));
  folderPreviewFlyout.addEventListener('mouseleave', hideFolderPreview);
}

export function renderFolders(){
  el.folderList.innerHTML = '';
  state.folders.forEach(f => {
    const isActive = f.id === state.activeFolderId;
    const li = document.createElement('li');
    li.className = 'folder-item' + (isActive ? ' active' : '');
    li.innerHTML = `
      <span class="folder-name">${f.color ? `<span class="folder-dot" style="background:${f.color}"></span>` : '📁'} ${escapeHtml(f.name)}</span>
      <div class="folder-item-actions">
        <button class="folder-action-btn folder-edit" type="button" title="Renombrar y cambiar color" aria-label="Editar carpeta ${escapeHtml(f.name)}" data-id="${f.id}">✏️</button>
        <button class="folder-action-btn folder-del" type="button" title="Eliminar carpeta" aria-label="Eliminar carpeta ${escapeHtml(f.name)}" data-id="${f.id}">✕</button>
      </div>
    `;
    li.addEventListener('click', (e) => {
      if(e.target.closest('.folder-item-actions')) return;
      selectFolder(f.id);
    });
    li.querySelector('.folder-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditFolderModal(f.id);
    });
    li.querySelector('.folder-del').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFolder(f.id);
    });
    li.addEventListener('mouseenter', () => showFolderPreview(li, f));
    li.addEventListener('mouseleave', hideFolderPreview);
    el.folderList.appendChild(li);
  });
}

export function showFolderPreview(li, folder){
  if(!folderPreviewFlyout) return;
  folderPreviewFlyout.setAttribute('data-folder-id', folder.id);
  folderPreviewFlyout.innerHTML = `<h5>Cargando…</h5>`;
  const rect = li.getBoundingClientRect();
  const sidebarRect = document.querySelector('.sidebar').getBoundingClientRect();
  let top = rect.top;
  const maxTop = window.innerHeight - 350;
  if(top > maxTop) top = Math.max(10, maxTop);
  folderPreviewFlyout.style.top = top + 'px';
  folderPreviewFlyout.style.left = (sidebarRect.right + 10) + 'px';
  folderPreviewFlyout.classList.add('open');

  const render = (notes) => {
    // Evita pintar resultados viejos si el mouse ya pasó a otra carpeta
    if(folderPreviewFlyout.getAttribute('data-folder-id') !== folder.id) return;
    folderPreviewFlyout.innerHTML = buildFolderPreviewHtml(folder, notes);
  };

  if(notesCache[folder.id]){
    render(notesCache[folder.id]);
  } else {
    loadNotes(folder.id).then(render);
  }
}

export function hideFolderPreview(){
  if(folderPreviewFlyout) folderPreviewFlyout.classList.remove('open');
}

export function buildFolderPreviewHtml(folder, notes){
  const label = escapeHtml(folder.name);
  if(!notes || notes.length === 0){
    return `<h5>${label}</h5><div class="folder-preview-empty">Aún no hay notas guardadas.</div>`;
  }
  const pinned = notes.filter(n => n.pinned).sort((a,b) => b.createdAt - a.createdAt);
  const rest = notes.filter(n => !n.pinned).sort((a,b) => b.createdAt - a.createdAt);
  const sorted = [...pinned, ...rest];
  const items = sorted.map(n => `
    <div class="folder-preview-item" data-note-id="${n.id}">
      <span class="folder-preview-date">${n.pinned ? '📌 ' : ''}${formatDate(n.createdAt)}</span>
      <span class="folder-preview-snippet">${escapeHtml(n.text)}</span>
    </div>
  `).join('');
  return `<h5>${label} (${notes.length})</h5>${items}`;
}
