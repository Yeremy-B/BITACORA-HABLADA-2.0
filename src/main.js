(function(){
  const state = {
    folders: [],
    activeFolderId: null,
    notes: [],
    currentNoteId: null,
    speaking: false,
    voices: [],
    allVoices: [],
    recognizing: false,
    sortMode: 'recientes',
    viewMode: 'detailed',
    tagFilter: null,
    searchQuery: '',
    searchGlobal: false,
    autoSave: true
  };
  const notesCache = {}; // folderId -> notas (para la vista previa al pasar el mouse)

  const el = {
    folderList: document.getElementById('folderList'),
    newFolderInput: document.getElementById('newFolderInput'),
    addFolderBtn: document.getElementById('addFolderBtn'),
    folderTitle: document.getElementById('folderTitle'),
    folderEyebrow: document.getElementById('folderEyebrow'),
    editor: document.getElementById('editor'),
    tagsInput: document.getElementById('tagsInput'),
    playBtn: document.getElementById('playBtn'),
    stopBtn: document.getElementById('stopBtn'),
    dictateBtn: document.getElementById('dictateBtn'),
    saveBtn: document.getElementById('saveBtn'),
    clearBtn: document.getElementById('clearBtn'),
    waveform: document.getElementById('waveform'),
    voiceSelect: document.getElementById('voiceSelect'),
    notesList: document.getElementById('notesList'),
    notesCount: document.getElementById('notesCount'),
    sortSelect: document.getElementById('sortSelect'),
    viewModeToggle: document.getElementById('viewModeToggle'),
    viewModeDetailedBtn: document.getElementById('viewModeDetailedBtn'),
    viewModeCompactBtn: document.getElementById('viewModeCompactBtn'),
    tagFilterRow: document.getElementById('tagFilterRow'),
    searchInput: document.getElementById('searchInput'),
    searchGlobalCheckbox: document.getElementById('searchGlobalCheckbox'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    statusLine: document.getElementById('statusLine'),
    previewVoiceBtn: document.getElementById('previewVoiceBtn'),
    editorOptionsBtn: document.getElementById('editorOptionsBtn'),
    editorOptionsMenu: document.getElementById('editorOptionsMenu'),
    autoSaveCheckbox: document.getElementById('autoSaveCheckbox'),
    autoSaveStatusLabel: document.getElementById('autoSaveStatusLabel'),
    autoSaveOptionRow: document.getElementById('autoSaveOptionRow'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    hamburgerBtn: document.getElementById('hamburgerBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    trashBtn: document.getElementById('trashBtn'),
    trashCount: document.getElementById('trashCount'),
    trashOverlay: document.getElementById('trashOverlay'),
    trashList: document.getElementById('trashList'),
    trashCloseBtn: document.getElementById('trashCloseBtn'),
    emptyTrashBtn: document.getElementById('emptyTrashBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    moveMenu: document.getElementById('moveMenu'),
    readingOverlay: document.getElementById('readingOverlay'),
    readingText: document.getElementById('readingText'),
    readingStopBtn: document.getElementById('readingStopBtn'),
    tabEditorBtn: document.getElementById('tabEditorBtn'),
    tabNotesBtn: document.getElementById('tabNotesBtn'),
    mobileNotesBadge: document.getElementById('mobileNotesBadge'),
    mobileNewNoteBtn: document.getElementById('mobileNewNoteBtn'),
    editorPane: document.getElementById('editorPane'),
    notesPane: document.getElementById('notesPane'),
    quickPreviewOverlay: document.getElementById('quickPreviewOverlay'),
    quickPreviewBadges: document.getElementById('quickPreviewBadges'),
    quickPreviewCloseX: document.getElementById('quickPreviewCloseX'),
    quickPreviewTitle: document.getElementById('quickPreviewTitle'),
    quickPreviewMeta: document.getElementById('quickPreviewMeta'),
    quickPreviewContent: document.getElementById('quickPreviewContent'),
    quickPreviewTags: document.getElementById('quickPreviewTags'),
    quickPreviewCopyBtn: document.getElementById('quickPreviewCopyBtn'),
    quickPreviewSpeakBtn: document.getElementById('quickPreviewSpeakBtn'),
    quickPreviewEditBtn: document.getElementById('quickPreviewEditBtn'),
    quickPreviewCloseBtn: document.getElementById('quickPreviewCloseBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText')
  };

  // ---------- MENÚ MÓVIL (carpetas en panel deslizable) ----------
  function openSidebar(){
    el.sidebar.classList.add('open');
    el.sidebarBackdrop.classList.add('open');
  }
  function closeSidebar(){
    el.sidebar.classList.remove('open');
    el.sidebarBackdrop.classList.remove('open');
  }
  el.hamburgerBtn.addEventListener('click', () => {
    el.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  el.sidebarCloseBtn.addEventListener('click', closeSidebar);
  el.sidebarBackdrop.addEventListener('click', closeSidebar);

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  // ---------- COLORES PARA CARPETAS CON NOMBRE REPETIDO ----------
  const DUPLICATE_PALETTE = ['#5B7FBD', '#8A5FBD', '#BD5F8A', '#4FA98F', '#BDA05F', '#BD725F', '#5FA0BD', '#8FA05F'];

  function normalizeName(name){ return name.trim().toLowerCase(); }

  // Da el color que le toca a una carpeta NUEVA según cuántas ya existen con ese mismo nombre
  function colorForNewFolder(name, existingFolders){
    const norm = normalizeName(name);
    const sameNameCount = existingFolders.filter(f => normalizeName(f.name) === norm).length;
    if(sameNameCount === 0) return null; // primera con ese nombre: sin color especial
    return DUPLICATE_PALETTE[(sameNameCount - 1) % DUPLICATE_PALETTE.length];
  }

  // Revisa TODAS las carpetas cargadas y corrige colores si faltan (p.ej. datos antiguos)
  function normalizeAllFolderColors(folders){
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

  // ---------- RESPALDO (EXPORTAR / IMPORTAR JSON) ----------
  async function exportBackup(){
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

  async function importBackupFile(file){
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
        text: String(n.text || ''),
        createdAt: n.createdAt || Date.now(),
        tags: Array.isArray(n.tags) ? n.tags : [],
        pinned: !!n.pinned
      })).filter(n => n.text.trim()) : [];
      await persistNotes(folder.id, notes);
    }
    await persistFolders();
    renderFolders();
    setStatus('Respaldo importado ✓');
  }

  // ---------- CUSTOM CONFIRM (los diálogos nativos pueden estar bloqueados) ----------
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalText = document.getElementById('modalText');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  let modalResolver = null;

  function askConfirm(title, text){
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalOverlay.classList.add('open');
    return new Promise((resolve) => { modalResolver = resolve; });
  }
  function closeModal(result){
    modalOverlay.classList.remove('open');
    if(modalResolver){ modalResolver(result); modalResolver = null; }
  }
  modalCancel.addEventListener('click', () => closeModal(false));
  modalConfirm.addEventListener('click', () => closeModal(true));
  modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(false); });

  function setStatus(msg, isError){
    el.statusLine.textContent = msg || '';
    el.statusLine.style.color = isError ? '#B4543F' : '';
    if(msg){
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(()=>{ el.statusLine.textContent=''; }, 3500);
    }
  }

  // ---------- BORRAR TODO EL EDITOR (rápido, con deshacer) ----------
  let lastClearedText = null;
  let lastClearedTags = '';

  function clearEditor(){
    if(autoSaveTimeout) clearTimeout(autoSaveTimeout);
    const text = el.editor.value;
    if(!text.trim()){
      setStatus('El editor ya está vacío.');
      return;
    }
    lastClearedText = text;
    lastClearedTags = el.tagsInput.value;
    el.editor.value = '';
    el.tagsInput.value = '';
    state.currentNoteId = null;
    el.editor.focus();
    showUndoStatus();
  }

  function showUndoStatus(){
    clearTimeout(setStatus._t);
    el.statusLine.style.color = '';
    el.statusLine.innerHTML = 'Editor vaciado. <button class="undo-link" id="undoClearBtn" type="button">Deshacer</button>';
    document.getElementById('undoClearBtn').addEventListener('click', () => {
      if(lastClearedText !== null){
        el.editor.value = lastClearedText;
        el.tagsInput.value = lastClearedTags;
        lastClearedText = null;
        el.editor.focus();
        setStatus('Texto restaurado.');
      }
    });
    setStatus._t = setTimeout(() => { el.statusLine.innerHTML = ''; }, 6000);
  }

  function formatDate(ts){
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

  // ---------- STORAGE (localStorage del navegador, funciona sin conexión) ----------
  const STORAGE_PREFIX = 'bitacoraHablada:';

  async function storageGet(key){
    try{
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? null : raw;
    }catch(e){
      setStatus('No se pudo leer el almacenamiento del navegador.', true);
      return null;
    }
  }
  async function storageSet(key, value){
    try{
      window.localStorage.setItem(STORAGE_PREFIX + key, value);
    }catch(e){
      setStatus('No se pudo guardar (¿memoria llena o modo privado?).', true);
    }
  }
  async function storageDelete(key){
    try{ window.localStorage.removeItem(STORAGE_PREFIX + key); }catch(e){}
  }

  async function loadFolders(){
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

  async function persistFolders(){
    await storageSet('folders', JSON.stringify(state.folders));
  }

  async function loadNotes(folderId){
    const raw = await storageGet('notes:' + folderId);
    let notes = [];
    if(raw){
      try{ notes = JSON.parse(raw); }catch(e){ notes = []; }
    }
    notesCache[folderId] = notes;
    return notes;
  }

  async function persistNotes(folderId, notes){
    await storageSet('notes:' + folderId, JSON.stringify(notes));
    notesCache[folderId] = notes;
  }

  // ---------- PAPELERA ----------
  const TRASH_MAX_DAYS = 30;
  let trashItems = [];

  async function loadTrash(){
    const raw = await storageGet('trash');
    let items = [];
    if(raw){
      try{ items = JSON.parse(raw); }catch(e){ items = []; }
    }
    const cutoff = Date.now() - TRASH_MAX_DAYS * 24 * 60 * 60 * 1000;
    const kept = items.filter(it => it.deletedAt > cutoff);
    if(kept.length !== items.length){
      await storageSet('trash', JSON.stringify(kept));
    }
    trashItems = kept;
    updateTrashCount();
    return trashItems;
  }

  async function persistTrash(){
    await storageSet('trash', JSON.stringify(trashItems));
    updateTrashCount();
  }

  function updateTrashCount(){
    el.trashCount.textContent = trashItems.length ? `(${trashItems.length})` : '';
  }

  async function sendNoteToTrash(note, folderId, folderName){
    trashItems.unshift({
      trashId: uid(),
      note: note,
      folderId: folderId,
      folderName: folderName,
      deletedAt: Date.now()
    });
    await persistTrash();
  }

  function renderTrash(){
    if(trashItems.length === 0){
      el.trashList.innerHTML = `<div class="trash-empty">La papelera está vacía.</div>`;
      return;
    }
    el.trashList.innerHTML = '';
    trashItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'trash-item';
      row.innerHTML = `
        <div class="trash-item-info">
          <div class="trash-item-meta">de «${escapeHtml(item.folderName)}» · eliminada ${formatDate(item.deletedAt)}</div>
          <div class="trash-item-text">${escapeHtml(item.note.text)}</div>
        </div>
        <div class="trash-item-actions">
          <button class="restore-btn" data-act="restore">↩ Restaurar</button>
          <button class="forget-btn" data-act="forget">Borrar ya</button>
        </div>
      `;
      row.querySelector('[data-act="restore"]').addEventListener('click', () => restoreTrashItem(item.trashId));
      row.querySelector('[data-act="forget"]').addEventListener('click', () => forgetTrashItem(item.trashId));
      el.trashList.appendChild(row);
    });
  }

  async function openTrash(){
    await loadTrash();
    renderTrash();
    el.trashOverlay.classList.add('open');
  }
  function closeTrash(){ el.trashOverlay.classList.remove('open'); }

  async function restoreTrashItem(trashId){
    const item = trashItems.find(it => it.trashId === trashId);
    if(!item) return;

    let targetFolder = state.folders.find(f => f.id === item.folderId);
    if(!targetFolder){
      // La carpeta original ya no existe: se recrea (o se reutiliza una con el mismo nombre)
      targetFolder = state.folders.find(f => normalizeName(f.name) === normalizeName(item.folderName));
      if(!targetFolder){
        const color = colorForNewFolder(item.folderName, state.folders);
        targetFolder = { id: uid(), name: item.folderName, createdAt: Date.now(), color };
        state.folders.push(targetFolder);
        await persistFolders();
        renderFolders();
      }
    }

    const targetNotes = notesCache[targetFolder.id] || await loadNotes(targetFolder.id);
    const restoredNote = { ...item.note };
    targetNotes.push(restoredNote);
    await persistNotes(targetFolder.id, targetNotes);

    trashItems = trashItems.filter(it => it.trashId !== trashId);
    await persistTrash();
    renderTrash();

    if(targetFolder.id === state.activeFolderId){
      state.notes = targetNotes;
      renderNotes();
    }
    setStatus(`Nota restaurada en «${targetFolder.name}».`);
  }

  async function forgetTrashItem(trashId){
    const ok = await askConfirm('Borrar para siempre', 'Esta nota se eliminará definitivamente y no se podrá recuperar.');
    if(!ok) return;
    trashItems = trashItems.filter(it => it.trashId !== trashId);
    await persistTrash();
    renderTrash();
  }

  async function emptyTrash(){
    if(trashItems.length === 0) return;
    const ok = await askConfirm('Vaciar papelera', `Se eliminarán definitivamente ${trashItems.length} nota(s). Esta acción no se puede deshacer.`);
    if(!ok) return;
    trashItems = [];
    await persistTrash();
    renderTrash();
    setStatus('Papelera vaciada.');
  }

  // ---------- RENDER ----------
  function renderFolders(){
    el.folderList.innerHTML = '';
    state.folders.forEach(f => {
      const isActive = f.id === state.activeFolderId;
      const li = document.createElement('li');
      li.className = 'folder-item' + (isActive ? ' active' : '');
      li.innerHTML = `
        <span class="folder-name">${f.color ? `<span class="folder-dot" style="background:${f.color}"></span>` : '📁'} ${escapeHtml(f.name)}</span>
        <button class="folder-del" title="Eliminar carpeta" data-id="${f.id}">✕</button>
      `;
      li.addEventListener('click', (e) => {
        if(e.target.classList.contains('folder-del')) return;
        selectFolder(f.id);
      });
      li.querySelector('.folder-del').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(f.id);
      });
      li.addEventListener('mouseenter', () => showFolderPreview(li, f));
      li.addEventListener('mouseleave', hideFolderPreview);
      el.folderList.appendChild(li);
    });
  }

  const folderPreviewFlyout = document.getElementById('folderPreviewFlyout');
  folderPreviewFlyout.addEventListener('click', (e) => {
    const item = e.target.closest('.folder-preview-item');
    if(!item) return;
    const folderId = folderPreviewFlyout.getAttribute('data-folder-id');
    const notes = notesCache[folderId] || [];
    const note = notes.find(n => n.id === item.getAttribute('data-note-id'));
    if(note){
      if(folderId !== state.activeFolderId){ selectFolder(folderId); }
      loadNoteIntoEditor(note);
      hideFolderPreview();
    }
  });
  // Mantiene el flyout visible si el mouse entra en él directamente
  folderPreviewFlyout.addEventListener('mouseenter', () => folderPreviewFlyout.classList.add('open'));
  folderPreviewFlyout.addEventListener('mouseleave', hideFolderPreview);

  function showFolderPreview(li, folder){
    folderPreviewFlyout.setAttribute('data-folder-id', folder.id);
    folderPreviewFlyout.innerHTML = `<h5>Cargando…</h5>`;
    const rect = li.getBoundingClientRect();
    const sidebarRect = document.querySelector('.sidebar').getBoundingClientRect();
    let top = rect.top;
    const maxTop = window.innerHeight - 350;
    if(top > maxTop) top = Math.max(10, maxTop);
    folderPreviewFlyout.style.top = top + 'px';
    folderPreviewFlyout.style.left = (sidebarRect.right + 10) + 'px';
    folderPreviewFlyout.classList.add('open');

    const render = (notes) => {
      // Evita pintar resultados viejos si el mouse ya pasó a otra carpeta
      if(folderPreviewFlyout.getAttribute('data-folder-id') !== folder.id) return;
      folderPreviewFlyout.innerHTML = buildFolderPreviewHtml(folder, notes);
    };

    if(notesCache[folder.id]){
      render(notesCache[folder.id]);
    } else {
      loadNotes(folder.id).then(render);
    }
  }

  function hideFolderPreview(){
    folderPreviewFlyout.classList.remove('open');
  }

  function buildFolderPreviewHtml(folder, notes){
    const label = escapeHtml(folder.name);
    if(!notes || notes.length === 0){
      return `<h5>${label}</h5><div class="folder-preview-empty">Aún no hay notas guardadas.</div>`;
    }
    const pinned = notes.filter(n => n.pinned).sort((a,b) => b.createdAt - a.createdAt);
    const rest = notes.filter(n => !n.pinned).sort((a,b) => b.createdAt - a.createdAt);
    const sorted = [...pinned, ...rest];
    const items = sorted.map(n => `
      <div class="folder-preview-item" data-note-id="${n.id}">
        <span class="folder-preview-date">${n.pinned ? '📌 ' : ''}${formatDate(n.createdAt)}</span>
        <span class="folder-preview-snippet">${escapeHtml(n.text)}</span>
      </div>
    `).join('');
    return `<h5>${label} (${notes.length})</h5>${items}`;
  }

  // ---------- VISTA PREVIA Y ESTRUCTURA DE NOTAS ----------
  function getNotePreview(text){
    const raw = (text || '').trim();
    if(!raw){
      return {
        title: 'Nota sin contenido',
        body: '',
        words: 0,
        chars: 0,
        readTime: '0s'
      };
    }
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let title = lines[0] || 'Nota sin título';
    let body = '';

    if(lines.length > 1){
      body = lines.slice(1).join('\n');
    } else {
      if(title.length > 65){
        const punctIdx = title.search(/[.!?]\s+/);
        if(punctIdx > 12 && punctIdx < 65){
          body = title.slice(punctIdx + 1).trim();
          title = title.slice(0, punctIdx + 1);
        }
      }
    }

    const words = raw.split(/\s+/).filter(Boolean).length;
    const chars = raw.length;
    const readSeconds = Math.max(1, Math.round(words / 3.2));
    const readTime = readSeconds < 60 ? `${readSeconds}s` : `${Math.ceil(readSeconds / 60)} min`;

    return { title, body, words, chars, readTime };
  }

  let currentPreviewNote = null;
  let currentPreviewFolder = null;

  function openQuickPreview(note, folderName){
    currentPreviewNote = note;
    currentPreviewFolder = folderName || (state.folders.find(f => f.id === state.activeFolderId)?.name || 'General');
    const prev = getNotePreview(note.text);

    let badgesHtml = '';
    if(note.pinned){
      badgesHtml += '<span class="pinned-badge">📌 Fijada</span>';
    }
    if(note.id === state.currentNoteId){
      badgesHtml += '<span class="active-badge">✏️ En editor</span>';
    }
    badgesHtml += `<span class="note-stats-pill">⏱️ ${prev.words} palabras · ${prev.chars} caracteres · ~${prev.readTime} de lectura</span>`;
    el.quickPreviewBadges.innerHTML = badgesHtml;

    el.quickPreviewTitle.textContent = prev.title;
    el.quickPreviewMeta.textContent = `📁 Carpeta: ${currentPreviewFolder} · 📅 ${formatDate(note.createdAt)}`;
    el.quickPreviewContent.textContent = note.text;

    if(note.tags && note.tags.length){
      el.quickPreviewTags.innerHTML = note.tags.map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('');
      el.quickPreviewTags.style.display = 'flex';
    } else {
      el.quickPreviewTags.innerHTML = '';
      el.quickPreviewTags.style.display = 'none';
    }

    el.quickPreviewOverlay.classList.add('open');
  }

  function closeQuickPreview(){
    el.quickPreviewOverlay.classList.remove('open');
    currentPreviewNote = null;
    currentPreviewFolder = null;
  }

  function renderNotes(){
    // ---- modo búsqueda global (en todas las carpetas) ----
    if(state.searchGlobal && state.searchQuery.trim()){
      el.tagFilterRow.innerHTML = '';
      renderGlobalSearchResults(state.searchQuery.trim());
      return;
    }

    // ---- fila de etiquetas disponibles en esta carpeta ----
    const allTags = Array.from(new Set(
      state.notes.flatMap(n => n.tags || [])
    )).sort((a,b) => a.localeCompare(b, 'es'));

    if(allTags.length === 0){
      el.tagFilterRow.innerHTML = '';
      state.tagFilter = null;
    } else {
      el.tagFilterRow.innerHTML =
        `<span class="tag-chip${state.tagFilter === null ? ' active' : ''}" data-tag="">Todas</span>` +
        allTags.map(t => `<span class="tag-chip${state.tagFilter === t ? ' active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');
      el.tagFilterRow.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const tag = chip.getAttribute('data-tag');
          state.tagFilter = tag ? tag : null;
          renderNotes();
        });
      });
    }

    // ---- filtrar ----
    let list = state.notes;
    if(state.tagFilter){
      list = list.filter(n => (n.tags || []).includes(state.tagFilter));
    }
    const q = state.searchQuery.trim().toLowerCase();
    if(q){
      list = list.filter(n =>
        n.text.toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    el.notesCount.textContent = list.length + (list.length === 1 ? ' nota' : ' notas');
    if(el.mobileNotesBadge){
      el.mobileNotesBadge.textContent = state.notes.length;
    }

    if(list.length === 0){
      el.notesList.innerHTML = `
        <div class="empty-state">
          <div class="glyph">${q ? '🔍' : '🗒️'}</div>
          <p>${q ? 'Sin resultados para tu búsqueda.' : (state.tagFilter ? 'No hay notas con esa etiqueta.' : 'Aún no hay notas en esta carpeta.<br>Escribe algo y pulsa «Guardar nota».')}</p>
        </div>`;
      return;
    }

    // ---- ordenar ----
    const sortFn = {
      recientes: (a,b) => b.createdAt - a.createdAt,
      antiguas: (a,b) => a.createdAt - b.createdAt,
      alfabetico: (a,b) => a.text.trim().toLowerCase().localeCompare(b.text.trim().toLowerCase(), 'es')
    }[state.sortMode] || ((a,b) => b.createdAt - a.createdAt);

    const pinned = list.filter(n => n.pinned).sort(sortFn);
    const rest = list.filter(n => !n.pinned).sort(sortFn);
    const ordered = [...pinned, ...rest];

    const isCompact = state.viewMode === 'compact';
    el.notesList.innerHTML = '';

    ordered.forEach(n => {
      const card = document.createElement('div');
      const isCurrent = (n.id === state.currentNoteId);
      card.className = 'note-card' +
        (n.pinned ? ' pinned' : '') +
        (isCurrent ? ' active-in-editor' : '') +
        (isCompact ? ' compact-view' : '');
      card.setAttribute('data-note-id', n.id);

      const prev = getNotePreview(n.text);
      const tagsHtml = (n.tags && n.tags.length)
        ? `<div class="note-tags">${n.tags.map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

      card.innerHTML = `
        <div class="note-card-top">
          <div class="note-card-badges">
            ${n.pinned ? '<span class="pinned-badge">📌 Fijada</span>' : ''}
            ${isCurrent ? '<span class="active-badge">✏️ En editor</span>' : ''}
            <span class="note-date">📅 ${formatDate(n.createdAt)}</span>
            <span class="note-stats-pill" title="${prev.words} palabras, ${prev.chars} caracteres">⏱️ ${prev.words} pal · ${prev.readTime}</span>
          </div>
          <div class="note-actions">
            <button class="icon-btn" title="Vista previa completa" data-act="preview">👁️</button>
            <button class="icon-btn pin-btn${n.pinned ? ' active' : ''}" title="${n.pinned ? 'Quitar fijado' : 'Fijar arriba'}" data-act="pin">${n.pinned ? '📌' : '📍'}</button>
            <button class="icon-btn" title="Leer en voz alta" data-act="play">🔊</button>
            <button class="icon-btn" title="Mover a otra carpeta" data-act="move">📂</button>
            <button class="icon-btn danger" title="Eliminar" data-act="del">🗑️</button>
          </div>
        </div>
        <div class="note-preview-content">
          <h4 class="note-preview-title">${escapeHtml(prev.title)}</h4>
          ${prev.body ? `<div class="note-preview-body">${escapeHtml(prev.body)}</div>` : ''}
        </div>
        ${tagsHtml ? `<div class="note-preview-footer">${tagsHtml}</div>` : ''}
      `;

      card.addEventListener('click', (e) => {
        const act = e.target.getAttribute('data-act');
        if(act === 'preview'){ e.stopPropagation(); openQuickPreview(n); return; }
        if(act === 'play'){ e.stopPropagation(); speak(n.text); return; }
        if(act === 'del'){ e.stopPropagation(); deleteNote(n.id); return; }
        if(act === 'pin'){ e.stopPropagation(); toggleImportant(n.id); return; }
        if(act === 'move'){ e.stopPropagation(); openMoveMenu(e.target, n.id, state.activeFolderId); return; }
        loadNoteIntoEditor(n);
      });
      el.notesList.appendChild(card);
    });
  }

  // ---------- BÚSQUEDA GLOBAL EN TODAS LAS CARPETAS ----------
  let searchToken = 0;
  async function renderGlobalSearchResults(query){
    const myToken = ++searchToken;
    el.notesCount.textContent = 'Buscando…';
    el.notesList.innerHTML = `<div class="empty-state"><div class="glyph">🔍</div><p>Buscando en todas las carpetas…</p></div>`;

    const q = query.toLowerCase();
    const results = [];
    for(const folder of state.folders){
      let notes = notesCache[folder.id];
      if(!notes){ notes = await loadNotes(folder.id); }
      notes.forEach(n => {
        if(n.text.toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q))){
          results.push({ note: n, folder });
        }
      });
    }
    if(myToken !== searchToken) return; // el usuario ya cambió la búsqueda, descarta este resultado

    results.sort((a,b) => (b.note.pinned - a.note.pinned) || (b.note.createdAt - a.note.createdAt));
    el.notesCount.textContent = results.length + (results.length === 1 ? ' resultado' : ' resultados');
    if(el.mobileNotesBadge){
      el.mobileNotesBadge.textContent = results.length;
    }

    if(results.length === 0){
      el.notesList.innerHTML = `<div class="empty-state"><div class="glyph">🔍</div><p>Sin resultados en ninguna carpeta.</p></div>`;
      return;
    }

    const isCompact = state.viewMode === 'compact';
    el.notesList.innerHTML = '';
    results.forEach(({note: n, folder}) => {
      const card = document.createElement('div');
      const isCurrent = (n.id === state.currentNoteId);
      card.className = 'note-card' +
        (n.pinned ? ' pinned' : '') +
        (isCurrent ? ' active-in-editor' : '') +
        (isCompact ? ' compact-view' : '');
      card.setAttribute('data-note-id', n.id);

      const prev = getNotePreview(n.text);
      const tagsHtml = (n.tags && n.tags.length)
        ? `<div class="note-tags">${n.tags.map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

      card.innerHTML = `
        <div class="note-card-top">
          <div class="note-card-badges">
            <span class="search-folder-badge">📁 ${escapeHtml(folder.name)}</span>
            ${n.pinned ? '<span class="pinned-badge">📌 Fijada</span>' : ''}
            ${isCurrent ? '<span class="active-badge">✏️ En editor</span>' : ''}
            <span class="note-date">📅 ${formatDate(n.createdAt)}</span>
            <span class="note-stats-pill">⏱️ ${prev.words} pal · ${prev.readTime}</span>
          </div>
          <div class="note-actions">
            <button class="icon-btn" title="Vista previa completa" data-act="preview">👁️</button>
            <button class="icon-btn" title="Leer en voz alta" data-act="play">🔊</button>
          </div>
        </div>
        <div class="note-preview-content">
          <h4 class="note-preview-title">${escapeHtml(prev.title)}</h4>
          ${prev.body ? `<div class="note-preview-body">${escapeHtml(prev.body)}</div>` : ''}
        </div>
        ${tagsHtml ? `<div class="note-preview-footer">${tagsHtml}</div>` : ''}
      `;

      card.addEventListener('click', async (e) => {
        const act = e.target.getAttribute('data-act');
        if(act === 'preview'){ e.stopPropagation(); openQuickPreview(n, folder.name); return; }
        if(act === 'play'){ e.stopPropagation(); speak(n.text); return; }
        state.searchQuery = '';
        state.searchGlobal = false;
        el.searchInput.value = '';
        if(el.searchClearBtn) el.searchClearBtn.style.display = 'none';
        el.searchGlobalCheckbox.checked = false;
        await selectFolder(folder.id);
        loadNoteIntoEditor(n);
      });
      el.notesList.appendChild(card);
    });
  }

  async function toggleImportant(id){
    const note = state.notes.find(n => n.id === id);
    if(!note) return;
    note.pinned = !note.pinned;
    await persistNotes(state.activeFolderId, state.notes);
    renderNotes();
    setStatus(note.pinned ? 'Nota fijada arriba.' : 'Nota ya no está fijada.');
  }

  // ---------- MOVER NOTA A OTRA CARPETA ----------
  let moveMenuHideTimer = null;

  function openMoveMenu(anchorEl, noteId, sourceFolderId){
    clearTimeout(moveMenuHideTimer);
    const others = state.folders.filter(f => f.id !== sourceFolderId);
    const label = `<div class="move-menu-label">Mover a…</div>`;
    if(others.length === 0){
      el.moveMenu.innerHTML = label + `<div class="move-menu-empty">No hay otra carpeta disponible.</div>`;
    } else {
      el.moveMenu.innerHTML = label + others.map(f => `
        <div class="move-menu-item" data-folder-id="${f.id}">
          ${f.color ? `<span class="folder-dot" style="background:${f.color}"></span>` : '📁'} ${escapeHtml(f.name)}
        </div>
      `).join('');
      el.moveMenu.querySelectorAll('.move-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          moveNoteToFolder(noteId, sourceFolderId, item.getAttribute('data-folder-id'));
          closeMoveMenu();
        });
      });
    }

    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left;
    if(left + 240 > window.innerWidth) left = window.innerWidth - 250;
    el.moveMenu.style.left = Math.max(10, left) + 'px';
    el.moveMenu.style.top = (rect.bottom + 6) + 'px';
    el.moveMenu.classList.add('open');

    document.addEventListener('click', outsideMoveMenuClick, { once: false });
  }

  function outsideMoveMenuClick(e){
    if(!el.moveMenu.contains(e.target) && !e.target.closest('[data-act="move"]')){
      closeMoveMenu();
    }
  }
  function closeMoveMenu(){
    el.moveMenu.classList.remove('open');
    document.removeEventListener('click', outsideMoveMenuClick);
  }

  async function moveNoteToFolder(noteId, sourceFolderId, targetFolderId){
    if(!targetFolderId || targetFolderId === sourceFolderId) return;
    const sourceNotes = sourceFolderId === state.activeFolderId ? state.notes : (notesCache[sourceFolderId] || await loadNotes(sourceFolderId));
    const idx = sourceNotes.findIndex(n => n.id === noteId);
    if(idx === -1) return;
    const [note] = sourceNotes.splice(idx, 1);
    await persistNotes(sourceFolderId, sourceNotes);

    const targetNotes = notesCache[targetFolderId] || await loadNotes(targetFolderId);
    targetNotes.push(note);
    await persistNotes(targetFolderId, targetNotes);

    if(sourceFolderId === state.activeFolderId){ state.notes = sourceNotes; }
    renderNotes();
    renderFolders();
    const targetFolder = state.folders.find(f => f.id === targetFolderId);
    setStatus(`Nota movida a «${targetFolder ? targetFolder.name : ''}».`);
  }

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ---------- FOLDER ACTIONS ----------
  async function selectFolder(id){
    if(autoSaveTimeout){
      clearTimeout(autoSaveTimeout);
      await autoSaveDraft();
    }
    state.activeFolderId = id;
    state.currentNoteId = null;
    state.tagFilter = null;
    el.editor.value = '';
    el.tagsInput.value = '';
    hideFolderPreview();
    closeSidebar();
    const f = state.folders.find(x => x.id === id);
    el.folderTitle.textContent = f ? f.name : '';
    renderFolders();
    setStatus('Cargando…');
    state.notes = await loadNotes(id);
    renderNotes();
    renderFolders();
    setStatus('');
  }

  async function addFolder(){
    const name = el.newFolderInput.value.trim();
    if(!name){ return; }
    const color = colorForNewFolder(name, state.folders);
    const folder = { id: uid(), name, createdAt: Date.now(), color };
    state.folders.push(folder);
    await persistFolders();
    el.newFolderInput.value = '';
    renderFolders();
    selectFolder(folder.id);
    setStatus(color ? 'Carpeta creada con un color distinto para diferenciarla.' : 'Carpeta creada.');
  }

  async function deleteFolder(id){
    if(state.folders.length <= 1){
      setStatus('Debe quedar al menos una carpeta.', true);
      return;
    }
    const f = state.folders.find(x => x.id === id);
    const ok = await askConfirm('Eliminar carpeta', `Se eliminará "${f ? f.name : ''}" y sus notas pasarán a la papelera. Podrás recuperarlas desde ahí.`);
    if(!ok) return;

    const notesInFolder = notesCache[id] || await loadNotes(id);
    for(const n of notesInFolder){
      await sendNoteToTrash(n, id, f ? f.name : 'Carpeta eliminada');
    }

    state.folders = state.folders.filter(x => x.id !== id);
    await persistFolders();
    await storageDelete('notes:' + id);
    delete notesCache[id];
    if(state.activeFolderId === id){
      await selectFolder(state.folders[0].id);
    } else {
      renderFolders();
    }
    setStatus('Carpeta eliminada. Sus notas quedaron en la papelera.');
  }

  // ---------- ETIQUETAS ----------
  function parseTags(raw){
    return Array.from(new Set(
      raw.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean)
    )).slice(0, 8);
  }

  // ---------- NOTE ACTIONS & AUTOSAVE ----------
  let autoSaveTimeout = null;

  function updateAutoSaveUI(enabled){
    state.autoSave = enabled;
    if(el.autoSaveCheckbox){
      el.autoSaveCheckbox.checked = enabled;
    }
    if(el.autoSaveStatusLabel){
      el.autoSaveStatusLabel.textContent = enabled
        ? 'Activado (guarda al escribir)'
        : 'Desactivado (guarda manualmente)';
    }
  }

  async function setAutoSave(enabled, notify = true){
    updateAutoSaveUI(enabled);
    if(!enabled && autoSaveTimeout){
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = null;
    }
    await storageSet('autoSave', enabled ? 'true' : 'false');
    if(notify){
      setStatus(enabled ? 'Guardado automático activado ✓' : 'Guardado automático desactivado ⏸');
    }
  }

  async function initAutoSave(){
    const saved = await storageGet('autoSave');
    const enabled = (saved === null || saved === 'true');
    updateAutoSaveUI(enabled);
  }

  function triggerAutoSave(){
    if(!state.autoSave) return;
    if(autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
      await autoSaveDraft();
    }, 700);
  }

  async function autoSaveDraft(){
    const text = el.editor.value.trim();
    if(!text) return;
    const tags = parseTags(el.tagsInput.value);

    if(state.currentNoteId){
      const idx = state.notes.findIndex(n => n.id === state.currentNoteId);
      if(idx !== -1){
        const current = state.notes[idx];
        const tagsChanged = JSON.stringify(current.tags || []) !== JSON.stringify(tags);
        if(current.text === text && !tagsChanged){
          return;
        }
        current.text = text;
        current.tags = tags;
        current.updatedAt = Date.now();
      }
    } else {
      const note = { id: uid(), text, createdAt: Date.now(), tags, pinned: false };
      state.notes.unshift(note);
      state.currentNoteId = note.id;
    }
    await persistNotes(state.activeFolderId, state.notes);
    renderNotes();
    renderFolders();
    setStatus('Guardado automático ✓');
  }

  async function saveNote(){
    if(autoSaveTimeout) clearTimeout(autoSaveTimeout);
    const text = el.editor.value.trim();
    if(!text){ setStatus('Escribe algo antes de guardar.', true); return; }
    const tags = parseTags(el.tagsInput.value);

    if(state.currentNoteId){
      const idx = state.notes.findIndex(n => n.id === state.currentNoteId);
      if(idx !== -1){
        state.notes[idx].text = text;
        state.notes[idx].tags = tags;
        state.notes[idx].updatedAt = Date.now();
      }
    } else {
      const note = { id: uid(), text, createdAt: Date.now(), tags, pinned: false };
      state.notes.unshift(note);
      state.currentNoteId = note.id;
    }
    await persistNotes(state.activeFolderId, state.notes);
    renderNotes();
    renderFolders();
    setStatus('Nota guardada ✓');
  }

  function loadNoteIntoEditor(note){
    state.currentNoteId = note.id;
    el.editor.value = note.text;
    el.tagsInput.value = (note.tags || []).join(', ');
    if(window.innerWidth <= 860){
      setMobileTab('editor');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    el.editor.focus();
  }

  // ---------- MODO MÓVIL (pestañas y navegación) ----------
  let activeMobileTab = 'editor';
  function setMobileTab(tab){
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

  function handleResize(){
    if(window.innerWidth > 860){
      el.editorPane.style.display = '';
      el.notesPane.style.display = '';
    } else {
      setMobileTab(activeMobileTab);
    }
  }
  window.addEventListener('resize', handleResize);

  async function deleteNote(id){
    const ok = await askConfirm('Eliminar nota', 'La nota se moverá a la papelera. Podrás recuperarla desde ahí durante 30 días.');
    if(!ok) return;
    const note = state.notes.find(n => n.id === id);
    const folder = state.folders.find(f => f.id === state.activeFolderId);
    state.notes = state.notes.filter(n => n.id !== id);
    await persistNotes(state.activeFolderId, state.notes);
    if(note){
      await sendNoteToTrash(note, state.activeFolderId, folder ? folder.name : '');
    }
    if(state.currentNoteId === id){
      state.currentNoteId = null;
      el.editor.value = '';
      el.tagsInput.value = '';
    }
    renderNotes();
    renderFolders();
    setStatus('Nota movida a la papelera.');
  }

  // ---------- TEXT TO SPEECH ----------
  function isSpanishVoice(v){
    if(!v) return false;
    const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('es') || lang.startsWith('spa') || name.includes('spanish') || name.includes('español') || name.includes('castilian');
  }

  function getVoiceDisplayName(v, isDefault){
    const name = v.name || 'Voz';
    const lang = (v.lang || '').replace(/_/g, '-');
    let flag = '🎙️';
    if(lang.startsWith('es-ES') || lang === 'es') flag = '🇪🇸';
    else if(lang.startsWith('es-MX')) flag = '🇲🇽';
    else if(lang.startsWith('es-US')) flag = '🇺🇸';
    else if(lang.startsWith('es-AR')) flag = '🇦🇷';
    else if(lang.startsWith('es-CO')) flag = '🇨🇴';
    else if(lang.startsWith('es-CL')) flag = '🇨🇱';
    else if(lang.startsWith('es')) flag = '🌎';

    let label = `${flag} ${name}` + (lang ? ` (${lang})` : '');
    if(isDefault){
      label += ' ★ Predeterminada';
    }
    return label;
  }

  async function findBestDefaultVoice(allVoices){
    if(!allVoices || allVoices.length === 0) return null;

    // 1. Preferencia guardada previamente por el usuario
    const savedVoice = await storageGet('preferredVoice');
    if(savedVoice){
      const found = allVoices.find(v => v.name === savedVoice);
      if(found) return found;
    }

    // 2. Voz en español que coincida con el idioma del navegador/sistema
    const userLang = (navigator.language || '').toLowerCase().replace(/_/g, '-');
    const matchLangVoice = allVoices.find(v => isSpanishVoice(v) && v.lang && v.lang.toLowerCase().replace(/_/g, '-') === userLang);
    if(matchLangVoice) return matchLangVoice;

    // 3. Voz en español marcada como predeterminada del sistema
    const defaultSpanish = allVoices.find(v => isSpanishVoice(v) && v.default);
    if(defaultSpanish) return defaultSpanish;

    // 4. Voces de alta calidad / naturales en español habituales en móviles (iOS Siri / Android Google / Windows / Mac)
    const preferredKeywords = [
      'google español', 'google spanish', 'mónica', 'monica', 'paulina', 'jorge',
      'francisca', 'diego', 'luciana', 'helena', 'raul', 'laura', 'miguel',
      'enrique', 'carmen', 'conchita', 'penelope', 'lupe', 'siri', 'neural', 'natural'
    ];
    for(const kw of preferredKeywords){
      const match = allVoices.find(v => isSpanishVoice(v) && v.name.toLowerCase().includes(kw));
      if(match) return match;
    }

    // 5. Primera voz disponible en español
    const anySpanish = allVoices.find(isSpanishVoice);
    if(anySpanish) return anySpanish;

    // 6. Voz predeterminada general del dispositivo
    const systemDefault = allVoices.find(v => v.default);
    if(systemDefault) return systemDefault;

    // 7. Primera voz disponible
    return allVoices[0];
  }

  let populateRetryCount = 0;
  let populateRetryTimer = null;

  async function populateVoices(){
    if(!('speechSynthesis' in window)){
      if(el.voiceSelect){
        el.voiceSelect.innerHTML = '<option value="">Síntesis de voz no disponible</option>';
      }
      return;
    }

    const all = window.speechSynthesis.getVoices() || [];
    state.allVoices = all;
    state.voices = all.filter(isSpanishVoice);

    if(all.length === 0){
      if(el.voiceSelect){
        el.voiceSelect.innerHTML = '<option value="">Cargando voces del dispositivo…</option>';
      }
      // Reintentar en móviles y tablets (iOS Safari y Android cargan las voces de forma diferida)
      if(populateRetryCount < 10){
        populateRetryCount++;
        clearTimeout(populateRetryTimer);
        populateRetryTimer = setTimeout(populateVoices, populateRetryCount * 250);
      }
      return;
    }

    clearTimeout(populateRetryTimer);

    const bestVoice = await findBestDefaultVoice(all);
    const savedVoice = await storageGet('preferredVoice');
    const targetVoiceName = (savedVoice && all.some(v => v.name === savedVoice))
      ? savedVoice
      : (bestVoice ? bestVoice.name : (all[0] ? all[0].name : ''));

    el.voiceSelect.innerHTML = '';

    const spanishList = state.voices;
    const otherList = all.filter(v => !isSpanishVoice(v));

    if(spanishList.length > 0){
      const esGroup = document.createElement('optgroup');
      esGroup.label = 'Voces en Español (Recomendadas)';
      spanishList.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = getVoiceDisplayName(v, bestVoice && v.name === bestVoice.name);
        esGroup.appendChild(opt);
      });
      el.voiceSelect.appendChild(esGroup);
    }

    if(otherList.length > 0){
      const otherGroup = document.createElement('optgroup');
      otherGroup.label = spanishList.length > 0 ? 'Otros idiomas' : 'Voces disponibles';
      otherList.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang || 'idioma'})` + (v.default ? ' ★' : '');
        otherGroup.appendChild(opt);
      });
      el.voiceSelect.appendChild(otherGroup);
    }

    if(targetVoiceName){
      el.voiceSelect.value = targetVoiceName;
    }

    // Pre-establecer y persistir la voz por defecto si aún no había una configurada
    if(!savedVoice && el.voiceSelect.value){
      await storageSet('preferredVoice', el.voiceSelect.value);
    }
  }

  function buildReadingWords(text){
    // Divide el texto en palabras (con su posición de inicio) para poder resaltarlas
    const matches = [...text.matchAll(/\S+/g)];
    el.readingText.innerHTML = matches
      .map(m => `<span class="rword" data-start="${m.index}">${escapeHtml(m[0])}</span>`)
      .join(' ');
    return matches.map(m => ({ start: m.index, end: m.index + m[0].length, el: null }));
  }

  function speak(text){
    if(!('speechSynthesis' in window)){
      setStatus('Este navegador no admite lectura por voz.', true);
      return;
    }
    text = (text || el.editor.value).trim();
    if(!text){ setStatus('No hay texto para leer.', true); return; }

    // En móviles y tablets, asegurar que el canal de síntesis esté activo
    try {
      window.speechSynthesis.cancel();
      if(window.speechSynthesis.paused){
        window.speechSynthesis.resume();
      }
    } catch(e){}

    const all = (state.allVoices && state.allVoices.length > 0)
      ? state.allVoices
      : (window.speechSynthesis.getVoices() || []);

    const chosenName = el.voiceSelect ? el.voiceSelect.value : '';
    let voice = all.find(v => v.name === chosenName);

    if(!voice){
      voice = all.find(isSpanishVoice) || all.find(v => v.default) || all[0];
      if(voice && el.voiceSelect){
        el.voiceSelect.value = voice.name;
      }
    }

    const utter = new SpeechSynthesisUtterance(text);
    if(voice){
      utter.voice = voice;
      utter.lang = voice.lang || 'es-ES';
    } else {
      utter.lang = (navigator.language && navigator.language.toLowerCase().startsWith('es')) ? navigator.language : 'es-ES';
    }
    utter.rate = 1.0;
    utter.pitch = 1.0;

    const words = buildReadingWords(text);
    const spans = el.readingText.querySelectorAll('.rword');
    let activeSpan = null;

    utter.onboundary = (event) => {
      if(event.name && event.name !== 'word') return;
      // Encuentra la palabra cuyo rango contiene el charIndex reportado
      let idx = words.findIndex(w => event.charIndex >= w.start && event.charIndex < w.end);
      if(idx === -1){
        idx = words.findIndex(w => w.start >= event.charIndex);
      }
      if(idx === -1) return;
      if(activeSpan) activeSpan.classList.remove('active');
      activeSpan = spans[idx];
      if(activeSpan){
        activeSpan.classList.add('active');
        activeSpan.scrollIntoView({ block:'center', behavior:'smooth' });
      }
    };

    utter.onstart = () => {
      state.speaking = true;
      el.waveform.classList.add('speaking');
      el.stopBtn.disabled = false;
      el.playBtn.disabled = true;
      el.readingOverlay.classList.add('open');
    };
    utter.onend = utter.onerror = () => {
      state.speaking = false;
      el.waveform.classList.remove('speaking');
      el.stopBtn.disabled = true;
      el.playBtn.disabled = false;
      el.readingOverlay.classList.remove('open');
      if(activeSpan) activeSpan.classList.remove('active');
    };
    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking(){
    if('speechSynthesis' in window){
      window.speechSynthesis.cancel();
    }
    state.speaking = false;
    el.waveform.classList.remove('speaking');
    el.stopBtn.disabled = true;
    el.playBtn.disabled = false;
    el.readingOverlay.classList.remove('open');
  }

  // ---------- DICTATION (speech to text) ----------
  let recognition = null;
  let textBeforeDictation = '';
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;

  function setupDictation(){
    if(!SR){
      if(el.dictateBtn){
        el.dictateBtn.disabled = true;
        el.dictateBtn.title = 'Dictado por voz no disponible en este navegador';
        el.dictateBtn.textContent = '🎙️ No disponible';
      }
      return;
    }
    try {
      recognition = new SR();
      const userLang = (navigator.language || '').replace(/_/g, '-');
      recognition.lang = userLang.toLowerCase().startsWith('es') ? userLang : 'es-CL';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        state.recognizing = true;
        const currentVal = el.editor.value.trim();
        textBeforeDictation = currentVal ? currentVal + ' ' : '';
        if(el.dictateBtn){
          el.dictateBtn.classList.add('on');
          el.dictateBtn.textContent = '🎙️ Escuchando…';
        }
        setStatus('Escuchando… habla con naturalidad');
      };

      recognition.onresult = (event) => {
        let finalSessionTranscript = '';
        let interimSessionTranscript = '';

        for(let i = 0; i < event.results.length; i++){
          const transcript = event.results[i][0].transcript;
          if(event.results[i].isFinal){
            finalSessionTranscript += transcript + ' ';
          } else {
            interimSessionTranscript += transcript;
          }
        }

        const combined = (textBeforeDictation + finalSessionTranscript + interimSessionTranscript).replace(/\s+/g, ' ');
        el.editor.value = combined;
        triggerAutoSave();
      };

      recognition.onerror = (e) => {
        if(e && e.error === 'no-speech'){
          return;
        }
        if(e && e.error === 'not-allowed'){
          setStatus('Permiso de micrófono denegado. Actívalo en la barra del navegador.', true);
        } else if(e && e.error === 'audio-capture'){
          setStatus('No se detectó ningún micrófono conectado.', true);
        } else {
          setStatus('No se pudo acceder al micrófono.', true);
        }
        stopDictation();
      };

      recognition.onend = () => {
        // Finalización natural del reconocimiento
        stopDictation();
      };
    } catch(err) {
      console.warn('SpeechRecognition initialization error:', err);
      recognition = null;
      if(el.dictateBtn){
        el.dictateBtn.disabled = true;
        el.dictateBtn.title = 'No se pudo iniciar el servicio de dictado';
        el.dictateBtn.textContent = '🎙️ No disponible';
      }
    }
  }

  function stopDictation(){
    state.recognizing = false;
    textBeforeDictation = '';
    if(el.dictateBtn && SR){
      el.dictateBtn.classList.remove('on');
      el.dictateBtn.textContent = '🎙️ Dictar';
    }
  }

  function toggleDictation(){
    if(!SR){
      setStatus('El dictado por voz requiere Google Chrome, Edge o Safari moderno.', true);
      return;
    }
    if(!recognition){
      setupDictation();
    }
    if(!recognition){
      setStatus('No se pudo inicializar el micrófono en este dispositivo.', true);
      return;
    }
    if(state.recognizing){
      try { recognition.stop(); } catch(e){}
      stopDictation();
      setStatus('Dictado detenido.');
    } else {
      try {
        recognition.start();
      } catch(e){
        try {
          recognition.stop();
        } catch(stopErr){}
        setTimeout(() => {
          try {
            recognition.start();
          } catch(retryErr){
            setStatus('No se pudo iniciar el micrófono. Revisa los permisos.', true);
          }
        }, 150);
      }
    }
  }

  // ---------- EVENTS ----------
  el.editor.addEventListener('input', triggerAutoSave);
  el.tagsInput.addEventListener('input', triggerAutoSave);
  el.addFolderBtn.addEventListener('click', addFolder);
  el.newFolderInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') addFolder(); });
  el.playBtn.addEventListener('click', () => speak());
  el.stopBtn.addEventListener('click', stopSpeaking);
  el.readingStopBtn.addEventListener('click', stopSpeaking);
  el.readingOverlay.addEventListener('click', (e) => { if(e.target === el.readingOverlay) stopSpeaking(); });
  el.saveBtn.addEventListener('click', saveNote);
  el.clearBtn.addEventListener('click', clearEditor);
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

  // Modo de visualización de notas (Previa vs Lista)
  function setViewMode(mode){
    state.viewMode = mode;
    if(mode === 'compact'){
      if(el.viewModeCompactBtn) el.viewModeCompactBtn.classList.add('active');
      if(el.viewModeDetailedBtn) el.viewModeDetailedBtn.classList.remove('active');
    } else {
      if(el.viewModeDetailedBtn) el.viewModeDetailedBtn.classList.add('active');
      if(el.viewModeCompactBtn) el.viewModeCompactBtn.classList.remove('active');
    }
    renderNotes();
  }

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
  if(el.quickPreviewSpeakBtn){
    el.quickPreviewSpeakBtn.addEventListener('click', () => {
      if(currentPreviewNote){
        speak(currentPreviewNote.text);
        closeQuickPreview();
      }
    });
  }
  if(el.quickPreviewEditBtn){
    el.quickPreviewEditBtn.addEventListener('click', () => {
      if(currentPreviewNote){
        loadNoteIntoEditor(currentPreviewNote);
        closeQuickPreview();
      }
    });
  }
  if(el.quickPreviewCopyBtn){
    el.quickPreviewCopyBtn.addEventListener('click', async () => {
      if(currentPreviewNote){
        try {
          if(navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(currentPreviewNote.text);
          } else {
            const ta = document.createElement('textarea');
            ta.value = currentPreviewNote.text;
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
      state.currentNoteId = null;
      el.editor.value = '';
      el.tagsInput.value = '';
      setMobileTab('editor');
      el.editor.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setStatus('Nuevo borrador en el editor.');
    });
  }

  el.dictateBtn.addEventListener('click', toggleDictation);
  el.previewVoiceBtn.addEventListener('click', () => {
    speak('Hola, así suena esta voz.');
  });
  el.voiceSelect.addEventListener('change', () => {
    storageSet('preferredVoice', el.voiceSelect.value);
    setStatus('Voz preferida guardada.');
  });

  el.trashBtn.addEventListener('click', openTrash);
  el.trashCloseBtn.addEventListener('click', closeTrash);
  el.emptyTrashBtn.addEventListener('click', emptyTrash);
  el.trashOverlay.addEventListener('click', (e) => { if(e.target === el.trashOverlay) closeTrash(); });

  el.exportBtn.addEventListener('click', exportBackup);
  el.importBtn.addEventListener('click', () => el.importFileInput.click());
  el.importFileInput.addEventListener('change', async () => {
    const file = el.importFileInput.files[0];
    if(file){ await importBackupFile(file); }
    el.importFileInput.value = '';
  });

  window.addEventListener('keydown', (e) => {
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ speak(); }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); saveNote(); }
  });

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

  // ---------- MENÚ DE OPCIONES DEL EDITOR (3 PUNTOS) ----------
  function toggleEditorOptionsMenu(e){
    if(e) e.stopPropagation();
    const isOpen = el.editorOptionsMenu && el.editorOptionsMenu.classList.contains('open');
    if(isOpen){
      closeEditorOptionsMenu();
    } else {
      openEditorOptionsMenu();
    }
  }

  function openEditorOptionsMenu(){
    if(!el.editorOptionsMenu) return;
    el.editorOptionsMenu.classList.add('open');
    if(el.editorOptionsBtn) el.editorOptionsBtn.classList.add('active');
    document.addEventListener('click', onOutsideEditorMenuClick);
    document.addEventListener('keydown', onEditorMenuKeyDown);
  }

  function closeEditorOptionsMenu(){
    if(!el.editorOptionsMenu) return;
    el.editorOptionsMenu.classList.remove('open');
    if(el.editorOptionsBtn) el.editorOptionsBtn.classList.remove('active');
    document.removeEventListener('click', onOutsideEditorMenuClick);
    document.removeEventListener('keydown', onEditorMenuKeyDown);
  }

  function onOutsideEditorMenuClick(e){
    if(el.editorOptionsMenu && !el.editorOptionsMenu.contains(e.target) && el.editorOptionsBtn && !el.editorOptionsBtn.contains(e.target)){
      closeEditorOptionsMenu();
    }
  }

  function onEditorMenuKeyDown(e){
    if(e.key === 'Escape'){
      closeEditorOptionsMenu();
    }
  }

  if(el.editorOptionsBtn){
    el.editorOptionsBtn.addEventListener('click', toggleEditorOptionsMenu);
  }
  if(el.autoSaveCheckbox){
    el.autoSaveCheckbox.addEventListener('change', (e) => {
      setAutoSave(e.target.checked);
    });
  }
  if(el.autoSaveOptionRow){
    el.autoSaveOptionRow.addEventListener('click', (e) => {
      if(e.target === el.autoSaveCheckbox || e.target.closest('.toggle-switch')) return;
      const next = !el.autoSaveCheckbox.checked;
      setAutoSave(next);
    });
  }

  // ---------- MODO CLARO / OSCURO ----------
  function updateThemeUI(isDark){
    if(isDark){
      document.body.classList.add('dark-mode');
      if(el.themeIcon) el.themeIcon.textContent = '☀️';
      if(el.themeText) el.themeText.textContent = 'Modo claro';
      if(el.themeToggleBtn){
        el.themeToggleBtn.setAttribute('title', 'Cambiar a modo claro');
        el.themeToggleBtn.setAttribute('aria-label', 'Cambiar a modo claro');
      }
    } else {
      document.body.classList.remove('dark-mode');
      if(el.themeIcon) el.themeIcon.textContent = '🌙';
      if(el.themeText) el.themeText.textContent = 'Modo oscuro';
      if(el.themeToggleBtn){
        el.themeToggleBtn.setAttribute('title', 'Cambiar a modo oscuro');
        el.themeToggleBtn.setAttribute('aria-label', 'Cambiar a modo oscuro');
      }
    }
  }

  async function toggleTheme(){
    const isDark = document.body.classList.contains('dark-mode');
    const nextDark = !isDark;
    updateThemeUI(nextDark);
    await storageSet('theme', nextDark ? 'dark' : 'light');
    setStatus(nextDark ? 'Modo oscuro activado 🌙' : 'Modo claro activado ☀️');
  }

  async function initTheme(){
    const saved = await storageGet('theme');
    const isDark = saved === 'dark';
    updateThemeUI(isDark);
  }

  if(el.themeToggleBtn){
    el.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // ---------- INIT ----------
  (async function init(){
    await initTheme();
    await initAutoSave();
    handleResize();
    setStatus('Cargando tu bitácora…');
    await loadFolders();
    renderFolders();
    const active = state.folders.find(f => f.id === state.activeFolderId);
    el.folderTitle.textContent = active ? active.name : '';
    state.notes = await loadNotes(state.activeFolderId);
    renderNotes();
    renderFolders();
    setupDictation();
    await loadTrash();
    setStatus('');
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('[SW] Error al registrar service worker:', err);
        });
      });
    }
  })();
})();
