import { el } from './state.js';
import { setStatus } from './ui.js';
import { triggerAutoSave, showUndoAiStatus } from './notes.js';

// ---------- ASISTENTE INVISIBLE DE PRODUCTIVIDAD (IA) ----------
export let currentAiResult = '';
export let currentAiAction = '';

export function isAppOnline(){
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function updateAIOnlineStatus(){
  const online = isAppOnline();
  if(el.aiStatusDot){
    el.aiStatusDot.className = 'ai-status-dot ' + (online ? 'online' : 'offline');
  }
  if(el.aiConnectionBadge){
    el.aiConnectionBadge.className = 'ai-badge' + (online ? '' : ' offline');
    el.aiConnectionBadge.textContent = online ? 'En línea' : 'Sin conexión';
  }
  if(el.aiOfflineNotice){
    el.aiOfflineNotice.style.display = online ? 'none' : 'block';
  }
  if(el.aiMenuItems){
    el.aiMenuItems.querySelectorAll('.ai-menu-item').forEach(btn => {
      btn.disabled = !online;
    });
  }
  if(el.aiMenuBtn){
    el.aiMenuBtn.setAttribute('title', online
      ? 'Asistente de productividad IA (en línea)'
      : 'Asistente de productividad IA (requiere conexión a internet)');
  }
}

export function toggleAiMenu(){
  if(!el.aiMenu) return;
  const isOpen = el.aiMenu.classList.contains('open');
  if(isOpen){
    closeAiMenu();
  } else {
    updateAIOnlineStatus();
    el.aiMenu.classList.add('open');
    document.addEventListener('click', handleOutsideAiClick);
  }
}

export function closeAiMenu(){
  if(!el.aiMenu) return;
  el.aiMenu.classList.remove('open');
  document.removeEventListener('click', handleOutsideAiClick);
}

export function handleOutsideAiClick(e){
  if(el.aiDropdown && !el.aiDropdown.contains(e.target)){
    closeAiMenu();
  }
}

export function openAiResultModal(title, bodyText, action){
  currentAiResult = bodyText;
  currentAiAction = action;
  if(el.aiResultTitle) el.aiResultTitle.textContent = title;
  if(el.aiResultBody) el.aiResultBody.textContent = bodyText;
  if(el.aiResultOverlay) el.aiResultOverlay.classList.add('open');
}

export function closeAiResultModal(){
  if(el.aiResultOverlay) el.aiResultOverlay.classList.remove('open');
}

export async function executeAiAction(action){
  closeAiMenu();

  if(!isAppOnline()){
    setStatus('Esta función de IA requiere conexión a internet.', true);
    return;
  }

  const text = el.editor.value.trim();
  if(!text){
    setStatus('Escribe o dicta algo en la nota antes de usar el asistente.', true);
    return;
  }

  const prevEditorText = el.editor.value;

  const originalBtnHtml = el.aiMenuBtn ? el.aiMenuBtn.innerHTML : '';
  if(el.aiMenuBtn){
    el.aiMenuBtn.classList.add('loading');
    el.aiMenuBtn.innerHTML = '✨ Pensando…';
  }
  setStatus('El asistente IA está procesando tu nota…');

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, text: el.editor.value })
    });

    if(!response.ok){
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error del servidor (${response.status})`);
    }

    const data = await response.json();

    if(action === 'format_dictation'){
      const result = data.result || '';
      if(result){
        el.editor.value = result;
        triggerAutoSave();
        if(data.fallback){
          showUndoAiStatus('IA no disponible: se aplicó una versión simplificada local.', prevEditorText);
        } else {
          showUndoAiStatus('Dictado puntuado y pulido ✓', prevEditorText);
        }
      } else {
        setStatus('No se generaron cambios en el texto.');
      }
    } else if(action === 'suggest_title' || action === 'title_and_tags'){
      let appliedTitle = data.title || data.result || '';
      if(appliedTitle){
        appliedTitle = appliedTitle.replace(/^["'#\s]+|["'\s]+$/g, '').trim();
        const prevTitle = el.noteTitleInput ? el.noteTitleInput.value : '';
        if(el.noteTitleInput){
          el.noteTitleInput.value = appliedTitle;
        }
        triggerAutoSave();
        if(data.fallback){
          showUndoAiStatus('IA no disponible: se aplicó una versión simplificada local.', prevEditorText, prevTitle);
        } else {
          showUndoAiStatus(`Título sugerido: "${appliedTitle}" ✓`, prevEditorText, prevTitle);
        }
      } else {
        if(data.fallback){
          setStatus('IA no disponible: se aplicó una versión simplificada local.');
        } else {
          setStatus('No se pudo sugerir un título.');
        }
      }
    } else if(action === 'summarize'){
      openAiResultModal('📝 Resumen de ideas clave', data.result || '', 'summarize');
      if(data.fallback){
        setStatus('IA no disponible: se aplicó una versión simplificada local.');
      } else {
        setStatus('Resumen generado.');
      }
    } else if (action === 'extract_tasks') {
      const result = (data.result || '').trim();
      if (!result) {
        setStatus(data.fallback
          ? 'IA no disponible: no se detectaron tareas con la versión local.'
          : 'No se detectaron tareas pendientes en esta nota.');
      } else {
        openAiResultModal('✅ Tareas pendientes detectadas', result, 'extract_tasks');
        setStatus(data.fallback
          ? 'IA no disponible: se aplicó una versión simplificada local.'
          : 'Tareas extraídas.');
      }
    }
  } catch(err){
    console.error('[AI Action Error]:', err);
    setStatus(err.message || 'No se pudo conectar con el servicio de IA.', true);
  } finally {
    if(el.aiMenuBtn){
      el.aiMenuBtn.classList.remove('loading');
      el.aiMenuBtn.innerHTML = originalBtnHtml;
      updateAIOnlineStatus();
    }
  }
}
