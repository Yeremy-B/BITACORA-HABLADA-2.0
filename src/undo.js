import { state, el } from './state.js';
import { escapeHtml } from './utils.js';
import { setStatus } from './ui.js';
import { cancelAutoSaveTimer, triggerAutoSave } from './notes.js';

// ---------- BORRAR TODO EL EDITOR (rápido, con deshacer) ----------
let lastClearedText = null;
let lastClearedTitle = null;

export function clearEditor(){
  cancelAutoSaveTimer();
  const text = el.editor.value;
  const title = el.noteTitleInput ? el.noteTitleInput.value : '';
  if(!text.trim() && !title.trim()){
    setStatus('El editor ya está vacío.');
    return;
  }
  lastClearedText = text;
  lastClearedTitle = title;
  el.editor.value = '';
  if(el.noteTitleInput) el.noteTitleInput.value = '';
  state.currentNoteId = null;
  el.editor.focus();
  showUndoStatus();
}

export function showUndoStatus(){
  clearTimeout(setStatus._t);
  el.statusLine.style.color = '';
  el.statusLine.innerHTML = 'Editor vaciado. <button class="undo-link" id="undoClearBtn" type="button">Deshacer</button>';
  document.getElementById('undoClearBtn').addEventListener('click', () => {
    if(lastClearedText !== null || lastClearedTitle !== null){
      el.editor.value = lastClearedText || '';
      if(el.noteTitleInput) el.noteTitleInput.value = lastClearedTitle || '';
      lastClearedText = null;
      lastClearedTitle = null;
      triggerAutoSave();
      el.editor.focus();
      setStatus('Nota restaurada ✓');
    }
  });
  setStatus._t = setTimeout(() => { el.statusLine.innerHTML = ''; }, 6000);
}

export function showUndoAiStatus(msg, prevText, prevTitle){
  clearTimeout(setStatus._t);
  el.statusLine.style.color = '';
  el.statusLine.innerHTML = `${escapeHtml(msg)} <button class="undo-link" id="undoAiBtn" type="button">Deshacer</button>`;
  const btn = document.getElementById('undoAiBtn');
  if(btn){
    btn.addEventListener('click', () => {
      if(prevText !== undefined) el.editor.value = prevText;
      if(prevTitle !== undefined && el.noteTitleInput) el.noteTitleInput.value = prevTitle;
      triggerAutoSave();
      el.editor.focus();
      setStatus('Cambio de IA deshecho.');
    });
  }
  setStatus._t = setTimeout(() => { el.statusLine.innerHTML = ''; }, 7000);
}
