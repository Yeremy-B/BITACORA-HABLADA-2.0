import { state, el } from './state.js';
import { persistFolders } from './storage.js';
import { setStatus } from './ui.js';
import { renderFolders } from './render-folders.js';
import { renderNotes } from './render-notes.js';

export const FOLDER_PALETTE = [
  { name: 'Esmeralda', color: '#2F6B63' },
  { name: 'Azul', color: '#3A6EA5' },
  { name: 'Púrpura', color: '#8B5CF6' },
  { name: 'Terracota', color: '#C86446' },
  { name: 'Ámbar', color: '#D4A373' },
  { name: 'Rosa', color: '#EC4899' },
  { name: 'Verde menta', color: '#10B981' },
  { name: 'Dorado', color: '#F59E0B' },
  { name: 'Pizarra', color: '#4B5563' }
];

let editingFolderId = null;
let selectedFolderColor = '';

export function openEditFolderModal(folderId) {
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return;

  editingFolderId = folderId;
  selectedFolderColor = folder.color || FOLDER_PALETTE[0].color;

  if (el.editFolderModalTitle) {
    el.editFolderModalTitle.textContent = `📁 Editar "${folder.name}"`;
  }
  if (el.editFolderNameInput) {
    el.editFolderNameInput.value = folder.name;
  }

  // Renderizar paleta de colores
  if (el.folderColorPalette) {
    el.folderColorPalette.innerHTML = '';
    FOLDER_PALETTE.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch-btn' + (item.color.toLowerCase() === selectedFolderColor.toLowerCase() ? ' active' : '');
      btn.style.backgroundColor = item.color;
      btn.setAttribute('title', item.name);
      btn.setAttribute('aria-label', `Color ${item.name}`);
      btn.innerHTML = `<span class="color-swatch-check">✓</span>`;
      btn.addEventListener('click', () => {
        selectedFolderColor = item.color;
        el.folderColorPalette.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      el.folderColorPalette.appendChild(btn);
    });
  }

  if (el.editFolderOverlay) {
    el.editFolderOverlay.classList.add('open');
    setTimeout(() => {
      if (el.editFolderNameInput) el.editFolderNameInput.focus();
    }, 50);
  }
}

export function closeEditFolderModal() {
  if (el.editFolderOverlay) {
    el.editFolderOverlay.classList.remove('open');
  }
  editingFolderId = null;
}

export async function saveFolderEdit() {
  if (!editingFolderId) return;
  const folder = state.folders.find(f => f.id === editingFolderId);
  if (!folder) {
    closeEditFolderModal();
    return;
  }

  const newName = (el.editFolderNameInput ? el.editFolderNameInput.value : '').trim();
  if (!newName) {
    setStatus('El nombre de la carpeta no puede estar vacío.', true);
    if (el.editFolderNameInput) el.editFolderNameInput.focus();
    return;
  }

  // Verificar duplicados (salvo la misma carpeta)
  const duplicate = state.folders.find(f => f.id !== editingFolderId && f.name.toLowerCase() === newName.toLowerCase());
  if (duplicate) {
    setStatus(`Ya existe una carpeta con el nombre "${newName}".`, true);
    return;
  }

  folder.name = newName;
  folder.color = selectedFolderColor || folder.color;

  await persistFolders();

  if (state.activeFolderId === editingFolderId) {
    if (el.folderTitle) el.folderTitle.textContent = folder.name;
  }

  renderFolders();
  renderNotes();
  closeEditFolderModal();

  setStatus(`Carpeta "${newName}" actualizada correctamente ✓`);
}
