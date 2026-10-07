import { state, el } from './state.js';
import { openSidebar, closeSidebar, closeModal, setStatus, setMobileTab, handleResize, shareToWhatsApp } from './ui.js';
import { storageSet } from './storage.js';
import {
  triggerAutoSave,
  addFolder,
  saveNote,
  clearEditor,
  renderNotes,
  setViewMode,
  closeQuickPreview,
  getCurrentPreviewNote,
  loadNoteIntoEditor,
  openSettingsModal,
  closeSettingsModal,
  cancelAutoSaveTimer,
  flushAutoSaveDraft,
  setAutoSave,
  showUndoAiStatus
} from './notes.js';
import { speak, stopSpeaking, populateVoices } from './tts.js';
import { toggleDictation } from './dictation.js';
import {
  currentAiResult,
  currentAiAction,
  toggleAiMenu,
  closeAiResultModal,
  executeAiAction,
  updateAIOnlineStatus
} from './ai.js';
import { openTrash, closeTrash, emptyTrash } from './trash.js';
import { exportBackup, importBackupFile } from './backup.js';
import { toggleTheme } from './theme.js';

export function initEvents(){
  // Menú móvil (carpetas en panel deslizable)
  el.hamburgerBtn.addEventListener('click', () => {
    el.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  el.sidebarCloseBtn.addEventListener('click', closeSidebar);
  el.sidebarBackdrop.addEventListener('click', closeSidebar);

  // Custom confirm modal
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  if(modalCancel) modalCancel.addEventListener('click', () => closeModal(false));
  if(modalConfirm) modalConfirm.addEventListener('click', () => closeModal(true));
  if(modalOverlay) modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(false); });

  // Editor inputs
  el.editor.addEventListener('input', triggerAutoSave);
  if(el.noteTitleInput) el.noteTitleInput.addEventListener('input', triggerAutoSave);
  el.addFolderBtn.addEventListener('click', addFolder);
  el.newFolderInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') addFolder(); });

  // Controles de audio y edición
  el.playBtn.addEventListener('click', () => speak());
  el.stopBtn.addEventListener('click', stopSpeaking);
  el.readingStopBtn.addEventListener('click', stopSpeaking);
  el.readingOverlay.addEventListener('click', (e) => { if(e.target === el.readingOverlay) stopSpeaking(); });
  el.saveBtn.addEventListener('click', saveNote);
  el.clearBtn.addEventListener('click', clearEditor);

  // Orden y búsqueda
  el.sortSelect.addEventListener('change', () => {
    state.sortMode = el.sortSelect.value;
    renderNotes();
  });

  let searchDebounce = null;
  el.searchInput.addEventListener('input', () => {
    if(el.searchClearBtn){
      el.searchClearBtn.style.display = el.searchInput.value.trim() ? 'block' : 'none';
    }
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchQuery = el.searchInput.value;
      renderNotes();
    }, 200);
  });
  if(el.searchClearBtn){
    el.searchClearBtn.addEventListener('click', () => {
      el.searchInput.value = '';
      el.searchClearBtn.style.display = 'none';
      state.searchQuery = '';
      renderNotes();
      el.searchInput.focus();
    });
  }
  el.searchGlobalCheckbox.addEventListener('change', () => {
    state.searchGlobal = el.searchGlobalCheckbox.checked;
    renderNotes();
  });

  // Eventos del Asistente IA
  if(el.aiMenuBtn){
    el.aiMenuBtn.addEventListener('click', toggleAiMenu);
  }
  if(el.aiMenuItems){
    el.aiMenuItems.querySelectorAll('.ai-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if(action) executeAiAction(action);
      });
    });
  }
  if(el.aiResultCloseBtn){
    el.aiResultCloseBtn.addEventListener('click', closeAiResultModal);
  }
  if(el.aiResultCloseX){
    el.aiResultCloseX.addEventListener('click', closeAiResultModal);
  }
  if(el.aiResultOverlay){
    el.aiResultOverlay.addEventListener('click', (e) => {
      if(e.target === el.aiResultOverlay) closeAiResultModal();
    });
  }
  if(el.aiResultCopyBtn){
    el.aiResultCopyBtn.addEventListener('click', async () => {
      if(currentAiResult){
        try {
          if(navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(currentAiResult);
          } else {
            const ta = document.createElement('textarea');
            ta.value = currentAiResult;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          setStatus('Resultado copiado al portapapeles ✓');
        } catch(e){
          setStatus('No se pudo copiar automáticamente.', true);
        }
      }
    });
  }
  if(el.aiResultAppendBtn){
    el.aiResultAppendBtn.addEventListener('click', () => {
      if(currentAiResult){
        const prev = el.editor.value.trim();
        const header = currentAiAction === 'summarize' ? '\n\n--- Resumen ---\n' : '\n\n--- Tareas ---\n';
        el.editor.value = prev + header + currentAiResult;
        triggerAutoSave();
        closeAiResultModal();
        el.editor.focus();
        setStatus('Agregado al final de la nota ✓');
      }
    });
  }
  if(el.aiResultReplaceBtn){
    el.aiResultReplaceBtn.addEventListener('click', () => {
      if(currentAiResult){
        const prevText = el.editor.value;
        el.editor.value = currentAiResult;
        triggerAutoSave();
        closeAiResultModal();
        el.editor.focus();
        showUndoAiStatus('Nota reemplazada con el contenido de la IA.', prevText);
      }
    });
  }

  window.addEventListener('online', updateAIOnlineStatus);
  window.addEventListener('offline', updateAIOnlineStatus);

  // Modo de visualización de notas (Previa vs Lista)
  if(el.viewModeDetailedBtn){
    el.viewModeDetailedBtn.addEventListener('click', () => setViewMode('detailed'));
  }
  if(el.viewModeCompactBtn){
    el.viewModeCompactBtn.addEventListener('click', () => setViewMode('compact'));
  }

  // Modal de vista previa rápida
  if(el.quickPreviewCloseBtn){
    el.quickPreviewCloseBtn.addEventListener('click', closeQuickPreview);
  }
  if(el.quickPreviewCloseX){
    el.quickPreviewCloseX.addEventListener('click', closeQuickPreview);
  }
  if(el.quickPreviewOverlay){
    el.quickPreviewOverlay.addEventListener('click', (e) => {
      if(e.target === el.quickPreviewOverlay) closeQuickPreview();
    });
  }
  if(el.quickPreviewWhatsappBtn){
    el.quickPreviewWhatsappBtn.addEventListener('click', () => {
      const note = getCurrentPreviewNote();
      if(note && note.text){
        shareToWhatsApp(note.text);
      }
    });
  }
  if(el.quickPreviewSpeakBtn){
    el.quickPreviewSpeakBtn.addEventListener('click', () => {
      const note = getCurrentPreviewNote();
      if(note){
        speak(note.text);
        closeQuickPreview();
      }
    });
  }
  if(el.quickPreviewEditBtn){
    el.quickPreviewEditBtn.addEventListener('click', () => {
      const note = getCurrentPreviewNote();
      if(note){
        loadNoteIntoEditor(note);
        closeQuickPreview();
      }
    });
  }
  if(el.quickPreviewCopyBtn){
    el.quickPreviewCopyBtn.addEventListener('click', async () => {
      const note = getCurrentPreviewNote();
      if(note){
        try {
          if(navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(note.text);
          } else {
            const ta = document.createElement('textarea');
            ta.value = note.text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          setStatus('Texto de la nota copiado al portapapeles ✓');
        } catch(err){
          setStatus('No se pudo copiar el texto automáticamente.', true);
        }
      }
    });
  }

  // Pestañas móviles y botón crear nota móvil
  if(el.tabEditorBtn){
    el.tabEditorBtn.addEventListener('click', () => setMobileTab('editor'));
  }
  if(el.tabNotesBtn){
    el.tabNotesBtn.addEventListener('click', () => setMobileTab('notes'));
  }
  if(el.mobileNewNoteBtn){
    el.mobileNewNoteBtn.addEventListener('click', () => {
      cancelAutoSaveTimer();
      state.currentNoteId = null;
      if(el.noteTitleInput) el.noteTitleInput.value = '';
      el.editor.value = '';
      setMobileTab('editor');
      el.editor.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setStatus('Nuevo borrador en el editor.');
    });
  }

  // Modal de Configuración (Voz y Guardado)
  if(el.settingsBtn) el.settingsBtn.addEventListener('click', openSettingsModal);
  if(el.sidebarSettingsBtn) el.sidebarSettingsBtn.addEventListener('click', () => {
    closeSidebar();
    openSettingsModal();
  });
  if(el.quickSettingsBtn) el.quickSettingsBtn.addEventListener('click', openSettingsModal);
  if(el.settingsCloseBtn) el.settingsCloseBtn.addEventListener('click', closeSettingsModal);
  if(el.settingsCloseX) el.settingsCloseX.addEventListener('click', closeSettingsModal);
  if(el.settingsOverlay){
    el.settingsOverlay.addEventListener('click', (e) => {
      if(e.target === el.settingsOverlay) closeSettingsModal();
    });
  }

  if(el.settingsWhatsappBtn){
    el.settingsWhatsappBtn.addEventListener('click', () => {
      const text = el.editor.value.trim();
      const title = el.noteTitleInput ? el.noteTitleInput.value.trim() : '';
      if(!text && !title){
        setStatus('Escribe o abre una nota en el editor antes de compartirla.', true);
        return;
      }
      closeSettingsModal();
      shareToWhatsApp(text, title);
    });
  }

  el.dictateBtn.addEventListener('click', toggleDictation);
  if(el.previewVoiceBtn){
    el.previewVoiceBtn.addEventListener('click', () => {
      speak('Hola, esta es una prueba de voz para la lectura de tus notas en Bitácora.', true);
    });
  }

  // Acciones de IA invocadas desde el modal de Configuración
  document.querySelectorAll('.settings-ai-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if(action){
        closeSettingsModal();
        executeAiAction(action);
      }
    });
  });

  if(el.voiceSelect){
    el.voiceSelect.addEventListener('change', () => {
      storageSet('preferredVoice', el.voiceSelect.value);
      setStatus('Voz preferida guardada.');
    });
  }
  if(el.voiceGenderFilter){
    el.voiceGenderFilter.addEventListener('change', async () => {
      state.voiceGenderFilter = el.voiceGenderFilter.value;
      await storageSet('voiceGenderFilter', state.voiceGenderFilter);
      // Al cambiar a masculina, ajustar el timbre automáticamente a masculino si estaba en normal
      if(state.voiceGenderFilter === 'male' && el.voicePitchSelect && el.voicePitchSelect.value === 'normal'){
        el.voicePitchSelect.value = 'male';
        state.voicePitch = 'male';
        await storageSet('voicePitch', 'male');
      }
      populateVoices();
      setStatus(`Filtro de voz: ${el.voiceGenderFilter.options[el.voiceGenderFilter.selectedIndex].text}`);
    });
  }
  if(el.voicePitchSelect){
    el.voicePitchSelect.addEventListener('change', async () => {
      state.voicePitch = el.voicePitchSelect.value;
      await storageSet('voicePitch', state.voicePitch);
      setStatus(`Timbre de voz configurado: ${el.voicePitchSelect.options[el.voicePitchSelect.selectedIndex].text}`);
    });
  }

  // Papelera
  el.trashBtn.addEventListener('click', openTrash);
  el.trashCloseBtn.addEventListener('click', closeTrash);
  el.emptyTrashBtn.addEventListener('click', emptyTrash);
  el.trashOverlay.addEventListener('click', (e) => { if(e.target === el.trashOverlay) closeTrash(); });

  // Respaldo
  el.exportBtn.addEventListener('click', exportBackup);
  el.importBtn.addEventListener('click', () => el.importFileInput.click());
  el.importFileInput.addEventListener('change', async () => {
    const file = el.importFileInput.files[0];
    if(file){ await importBackupFile(file); }
    el.importFileInput.value = '';
  });

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ speak(); }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); saveNote(); }
  });

  // Síntesis de voz
  if('speechSynthesis' in window){
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
    if(typeof window.speechSynthesis.addEventListener === 'function'){
      window.speechSynthesis.addEventListener('voiceschanged', populateVoices);
    }
    // Desbloqueo y carga de voces en móviles y tablets al primer toque
    const unlockMobileVoices = () => {
      populateVoices();
      window.removeEventListener('touchstart', unlockMobileVoices);
      window.removeEventListener('click', unlockMobileVoices);
    };
    window.addEventListener('touchstart', unlockMobileVoices, { passive: true });
    window.addEventListener('click', unlockMobileVoices, { passive: true });
  }

  // Guardado automático
  if(el.autoSaveCheckbox){
    el.autoSaveCheckbox.addEventListener('change', (e) => {
      setAutoSave(e.target.checked);
    });
  }

  // Modo claro / oscuro
  if(el.themeToggleBtn){
    el.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Redimensión de pantalla
  window.addEventListener('resize', handleResize);

  // Guardado de emergencia si el usuario cierra o cambia de pestaña
  window.addEventListener('beforeunload', () => {
    flushAutoSaveDraft();
  });
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden'){
      flushAutoSaveDraft();
    }
  });
}
