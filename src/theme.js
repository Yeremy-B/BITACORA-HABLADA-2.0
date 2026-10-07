import { el } from './state.js';
import { storageGet, storageSet } from './storage.js';
import { setStatus } from './ui.js';

// ---------- MODO CLARO / OSCURO ----------
export function updateThemeUI(isDark){
  if(isDark){
    document.body.classList.add('dark-mode');
    if(el.themeIcon) el.themeIcon.textContent = '☀️';
    if(el.themeToggleBtn){
      el.themeToggleBtn.setAttribute('title', 'Cambiar a modo claro');
      el.themeToggleBtn.setAttribute('aria-label', 'Cambiar a modo claro');
    }
  } else {
    document.body.classList.remove('dark-mode');
    if(el.themeIcon) el.themeIcon.textContent = '🌙';
    if(el.themeToggleBtn){
      el.themeToggleBtn.setAttribute('title', 'Cambiar a modo oscuro');
      el.themeToggleBtn.setAttribute('aria-label', 'Cambiar a modo oscuro');
    }
  }
}

export async function toggleTheme(){
  const isDark = document.body.classList.contains('dark-mode');
  const nextDark = !isDark;
  updateThemeUI(nextDark);
  await storageSet('theme', nextDark ? 'dark' : 'light');
  setStatus(nextDark ? 'Modo oscuro activado 🌙' : 'Modo claro activado ☀️');
}

export async function initTheme(){
  const saved = await storageGet('theme');
  const isDark = saved === 'dark';
  updateThemeUI(isDark);
}
