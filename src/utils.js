export function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ---------- COLORES PARA CARPETAS CON NOMBRE REPETIDO ----------
export const DUPLICATE_PALETTE = ['#5B7FBD', '#8A5FBD', '#BD5F8A', '#4FA98F', '#BDA05F', '#BD725F', '#5FA0BD', '#8FA05F'];

export function normalizeName(name){ return name.trim().toLowerCase(); }

// Da el color que le toca a una carpeta NUEVA según cuántas ya existen con ese mismo nombre
export function colorForNewFolder(name, existingFolders){
  const norm = normalizeName(name);
  const sameNameCount = existingFolders.filter(f => normalizeName(f.name) === norm).length;
  if(sameNameCount === 0) return null; // primera con ese nombre: sin color especial
  return DUPLICATE_PALETTE[(sameNameCount - 1) % DUPLICATE_PALETTE.length];
}

// Revisa TODAS las carpetas cargadas y corrige colores si faltan (p.ej. datos antiguos)
export function normalizeAllFolderColors(folders){
  const groups = {};
  folders.slice().sort((a,b) => a.createdAt - b.createdAt).forEach(f => {
    const norm = normalizeName(f.name);
    groups[norm] = groups[norm] || [];
    groups[norm].push(f);
  });
  let changed = false;
  Object.values(groups).forEach(group => {
    group.forEach((f, idx) => {
      const expected = idx === 0 ? null : DUPLICATE_PALETTE[(idx - 1) % DUPLICATE_PALETTE.length];
      if(f.color !== expected){ f.color = expected; changed = true; }
    });
  });
  return changed;
}

export function formatDate(ts){
  if(!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  if(diff >= 0 && diff < 60000){
    return 'Ahora mismo';
  }
  if(diff >= 60000 && diff < 3600000){
    const mins = Math.floor(diff / 60000);
    return `Hace ${mins} min`;
  }
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.getDate() === today.getDate() &&
                  d.getMonth() === today.getMonth() &&
                  d.getFullYear() === today.getFullYear();
  const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if(isToday){
    return `Hoy, ${timeStr}`;
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
                      d.getMonth() === yesterday.getMonth() &&
                      d.getFullYear() === yesterday.getFullYear();
  if(isYesterday){
    return `Ayer, ${timeStr}`;
  }
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' · ' + timeStr;
}

export function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
