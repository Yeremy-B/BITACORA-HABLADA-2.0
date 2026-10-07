import { state, notesCache } from './state.js';
import { uid, colorForNewFolder } from './utils.js';
import { loadNotes, persistNotes, persistFolders } from './storage.js';
import { askConfirm, setStatus } from './ui.js';
import { renderFolders } from './notes.js';

// ---------- RESPALDO (EXPORTAR / IMPORTAR JSON) ----------
export async function exportBackup(){
  setStatus('Preparando respaldo…');
  const backup = {
    app: 'Bitácora Hablada',
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: []
  };
  for(const f of state.folders){
    const notes = notesCache[f.id] || await loadNotes(f.id);
    backup.folders.push({ name: f.name, color: f.color, notes });
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `bitacora-hablada-respaldo-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  setStatus('Respaldo descargado ✓');
}

export async function importBackupFile(file){
  setStatus('Leyendo respaldo…');
  let data;
  try{
    const raw = await file.text();
    data = JSON.parse(raw);
  }catch(e){
    setStatus('El archivo no es un respaldo válido.', true);
    return;
  }
  if(!data || !Array.isArray(data.folders)){
    setStatus('El archivo no tiene el formato esperado.', true);
    return;
  }
  const ok = await askConfirm('Importar respaldo', `Se agregarán ${data.folders.length} carpeta(s) del archivo como carpetas nuevas, sin borrar lo que ya tienes.`);
  if(!ok) return;

  for(const fData of data.folders){
    const name = (fData.name || 'Importada').toString().trim() || 'Importada';
    const color = colorForNewFolder(name, state.folders);
    const folder = { id: uid(), name, createdAt: Date.now(), color };
    state.folders.push(folder);
    const notes = Array.isArray(fData.notes) ? fData.notes.map(n => ({
      id: uid(),
      title: String(n.title || '').trim(),
      text: String(n.text || ''),
      createdAt: n.createdAt || Date.now(),
      tags: Array.isArray(n.tags) ? n.tags : [],
      pinned: !!n.pinned
    })).filter(n => n.text.trim() || n.title.trim()) : [];
    await persistNotes(folder.id, notes);
  }
  await persistFolders();
  renderFolders();
  setStatus('Respaldo importado ✓');
}
