import { state, el, notesCache } from './state.js';
import { uid, normalizeAllFolderColors } from './utils.js';
import { setStatus } from './ui.js';

// ---------- STORAGE (localStorage del navegador, funciona sin conexión) ----------
export const STORAGE_PREFIX = 'bitacoraHablada:';
export const STORAGE_MAX_ESTIMATE_BYTES = 5 * 1024 * 1024; // ~5 MB
let storageWarningShownThisSession = false;

export function getAppStorageUsage(){
  let totalBytes = 0;
  try {
    if(typeof window !== 'undefined' && window.localStorage){
      for(let i = 0; i < window.localStorage.length; i++){
        const k = window.localStorage.key(i);
        if(k && k.startsWith(STORAGE_PREFIX)){
          const val = window.localStorage.getItem(k) || '';
          totalBytes += (k.length + val.length) * 2;
        }
      }
    }
  }catch(_){
    // Ignorar errores al calcular uso de almacenamiento
  }
  return totalBytes;
}

export function checkStorageThreshold(){
  if(storageWarningShownThisSession) return;
  const bytes = getAppStorageUsage();
  if(bytes >= STORAGE_MAX_ESTIMATE_BYTES * 0.8){
    storageWarningShownThisSession = true;
    setStatus('Almacenamiento casi lleno (>80%). Te sugerimos exportar un respaldo desde ⚙️ Configuración.', true);
  }
}

export function updateStorageUsageUI(){
  if(!el.settingsStorageInfo) return;
  const bytes = getAppStorageUsage();
  const kb = (bytes / 1024).toFixed(1);
  el.settingsStorageInfo.textContent = `Uso de almacenamiento: ${kb} KB de ~5 MB`;
}

export async function storageGet(key){
  try{
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? null : raw;
  }catch(e){
    setStatus('No se pudo leer el almacenamiento del navegador.', true);
    return null;
  }
}

export async function storageSet(key, value){
  try{
    window.localStorage.setItem(STORAGE_PREFIX + key, value);
    checkStorageThreshold();
    updateStorageUsageUI();
  }catch(e){
    const isQuota = e && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    );
    if(isQuota){
      setStatus('Almacenamiento lleno: exporta un respaldo y libera espacio', true);
    } else {
      setStatus('No se pudo guardar (¿memoria llena o modo privado?).', true);
    }
  }
}

export async function storageDelete(key){
  try{ 
    window.localStorage.removeItem(STORAGE_PREFIX + key);
    updateStorageUsageUI();
  }catch(e){}
}

export async function loadFolders(){
  const raw = await storageGet('folders');
  if(raw){
    try{ state.folders = JSON.parse(raw); }catch(e){ state.folders = []; }
  }
  if(!state.folders || state.folders.length === 0){
    state.folders = [{ id: uid(), name: 'General', createdAt: Date.now(), color: null }];
    await storageSet('folders', JSON.stringify(state.folders));
  } else if(normalizeAllFolderColors(state.folders)){
    await storageSet('folders', JSON.stringify(state.folders));
  }
  state.activeFolderId = state.folders[0].id;
}

export async function persistFolders(){
  await storageSet('folders', JSON.stringify(state.folders));
}

export async function loadNotes(folderId){
  const raw = await storageGet('notes:' + folderId);
  let notes = [];
  if(raw){
    try{ notes = JSON.parse(raw); }catch(e){ notes = []; }
  }
  notesCache[folderId] = notes;
  return notes;
}

export async function persistNotes(folderId, notes){
  await storageSet('notes:' + folderId, JSON.stringify(notes));
  notesCache[folderId] = notes;
}
