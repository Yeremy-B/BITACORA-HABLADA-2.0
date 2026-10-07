import { el } from './state.js';

// ---------- MENÚ MÓVIL (carpetas en panel deslizable) ----------
export function openSidebar(){
  el.sidebar.classList.add('open');
  el.sidebarBackdrop.classList.add('open');
}
export function closeSidebar(){
  el.sidebar.classList.remove('open');
  el.sidebarBackdrop.classList.remove('open');
}

// ---------- CUSTOM CONFIRM (los diálogos nativos pueden estar bloqueados) ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
let modalResolver = null;

export function askConfirm(title, text){
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalOverlay.classList.add('open');
  return new Promise((resolve) => { modalResolver = resolve; });
}

export function closeModal(result){
  modalOverlay.classList.remove('open');
  if(modalResolver){ modalResolver(result); modalResolver = null; }
}

export function setStatus(msg, isError){
  el.statusLine.textContent = msg || '';
  el.statusLine.style.color = isError ? '#B4543F' : '';
  if(msg){
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(()=>{ el.statusLine.textContent=''; }, 3500);
  }
}

// ---------- MODO MÓVIL (pestañas y navegación) ----------
let activeMobileTab = 'editor';

export function setMobileTab(tab){
  activeMobileTab = tab;
  if(tab === 'editor'){
    el.tabEditorBtn.classList.add('active');
    el.tabNotesBtn.classList.remove('active');
    if(window.innerWidth <= 860){
      el.editorPane.style.display = 'flex';
      el.notesPane.style.display = 'none';
    }
  } else {
    el.tabNotesBtn.classList.add('active');
    el.tabEditorBtn.classList.remove('active');
    if(window.innerWidth <= 860){
      el.notesPane.style.display = 'flex';
      el.editorPane.style.display = 'none';
    }
  }
}

export function handleResize(){
  if(window.innerWidth > 860){
    el.editorPane.style.display = '';
    el.notesPane.style.display = '';
  } else {
    setMobileTab(activeMobileTab);
  }
}

// ---------- COMPARTIR EN WHATSAPP ----------
export function shareToWhatsApp(text, title){
  let clean = (text || '').trim();
  const cleanTitle = (title || '').trim();
  if(cleanTitle){
    clean = `*${cleanTitle}*\n\n` + clean;
  }
  if(!clean){
    setStatus('No hay contenido en la nota para compartir.', true);
    return;
  }
  const encoded = encodeURIComponent(clean);
  const url = `https://api.whatsapp.com/send?text=${encoded}`;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setStatus('Abriendo WhatsApp con tu nota… ✓');
}
