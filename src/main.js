import { state, el } from './state.js';
import { setStatus, handleResize } from './ui.js';
import { storageGet, loadFolders, loadNotes } from './storage.js';
import { initTheme } from './theme.js';
import { initAutoSave, renderFolders, renderNotes } from './notes.js';
import { setupDictation } from './dictation.js';
import { loadTrash } from './trash.js';
import { updateAIOnlineStatus } from './ai.js';
import { initEvents } from './events.js';

// Inicializar escuchadores de eventos
initEvents();

// ---------- INIT ----------
(async function init(){
  await initTheme();
  await initAutoSave();

  // Cargar preferencias de voz (género y timbre)
  const savedGender = await storageGet('voiceGenderFilter');
  if(savedGender){
    state.voiceGenderFilter = savedGender;
    if(el.voiceGenderFilter) el.voiceGenderFilter.value = savedGender;
  }
  const savedPitch = await storageGet('voicePitch');
  if(savedPitch){
    state.voicePitch = savedPitch;
    if(el.voicePitchSelect) el.voicePitchSelect.value = savedPitch;
  }

  handleResize();
  setStatus('Cargando tu bitácora…');
  await loadFolders();
  renderFolders();
  const active = state.folders.find(f => f.id === state.activeFolderId);
  el.folderTitle.textContent = active ? active.name : '';
  state.notes = await loadNotes(state.activeFolderId);
  renderNotes();
  setupDictation();
  await loadTrash();
  updateAIOnlineStatus();
  setStatus('');
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('[SW] Error al registrar service worker:', err);
      });
    });
  }
})();
