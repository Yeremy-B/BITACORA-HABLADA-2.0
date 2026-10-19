# Eliminación de la Traducción de Idiomas y Limpieza de la Interfaz

Plan para retirar de forma limpia y completa la función de traducción de idiomas de la aplicación de notas de voz, simplificando la barra de herramientas del editor y la configuración en la ventana de ajustes de acuerdo con las decisiones confirmadas.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario en la fase de clarificación:**
> - **Alcance funcional:** Eliminar la traducción de idiomas por completo sin sustituirla por otra herramienta de IA, manteniendo la interfaz despejada y enfocada en notas de voz, formateo de dictado, resúmenes y extracción de tareas.
> - **Alcance visual:** Remover tanto el botón «🌐 Traducir» de la barra de herramientas principal como la sección completa del selector de idioma destino en la ventana modal de «Ajustes».

- **Decisión confirmada 1:** Eliminación completa del botón `#translateBtn` en la barra de herramientas del editor, permitiendo un flujo visual más compacto y directo hacia «Guardar nota», «Borrar» y «Ajustes».
- **Decisión confirmada 2:** Retiro de la sección `#translateTargetSelect` («🌐 Idioma de traducción») en el modal de configuración, conservando únicamente las secciones relevantes: ajustes de voz, guardado automático, exportación/respaldo y compartir en WhatsApp.
- **Limpieza de arquitectura interna:** Desacoplar `translator.js` y las referencias al modal de traducción en `events.js`, `state.js`, y los estilos CSS específicos de `.btn-translate`, manteniendo intacto el resto de acciones de IA (`format_dictation`, `summarize`, `extract_tasks`, `suggest_title`).

---

### 1. Overview & Core Concept

- **Qué hace:** Simplifica y agiliza la experiencia de toma y edición de notas de voz retirando la funcionalidad de traducción que ya no es requerida por el usuario.
- **Audiencia objetivo:** Personas que utilizan la bitácora de voz en español para registrar pensamientos, dictados rápidos, resúmenes de reuniones y listas de tareas sin distracciones ni botones redundantes.
- **Valor clave:** Reduce la carga cognitiva en la barra de herramientas, elimina dependencias no deseadas de traducción y optimiza la ventana de configuración para que solo contenga ajustes pertinentes al dictado y almacenamiento de notas.

---

### 2. User Experience & Visual Design

#### Flujo de usuario actualizado
1. **Barra de herramientas del editor:**
   - Grupo 1 (Dictado y reproducción): Botón «Grabar / Dictar», «Escuchar», «Detener».
   - Grupo 2 (Inteligencia Artificial): Botón desplegable «✨ Asistente IA» (con opciones: Formato y puntuación del dictado, Sugerir título, Resumir ideas clave, Extraer tareas pendientes).
   - Divisor sutil.
   - Grupo 3 (Gestión de nota): «💾 Guardar nota» y «🧹 Borrar».
   - Zona derecha: Botón «⚙️ Ajustes».
   *(El botón `🌐 Traducir` queda completamente retirado).*

2. **Ventana Modal de Ajustes:**
   - Sección de Voces y Timbre (Síntesis de voz).
   - Sección de Acciones de IA directas (Formato, Resumen, Tareas).
   - Sección de Guardado automático (Switch toggle).
   - Sección de Compartir en WhatsApp.
   - Sección de Copia de Seguridad y Respaldo (Exportar/Importar JSON).
   *(La sección «🌐 Idioma de traducción» y su `<select>` quedan completamente retirados).*

#### Identidad visual y ergonomía
- **Filosofía Anti-Slop:** Cero botones decorativos o sin función; botones con etiquetas en lenguaje natural y proporciones visuales equilibradas (`py-2 px-4`).
- **Paleta de color:** Coherencia en tema claro y oscuro (`--surface`, `--surface-card`, `--text-primary`, `--primary`).
- **Respuesta táctil:** Controles con hitbox mínimo de 44px en móviles y espaciado consistente.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Retiro completo vs. Ocultamiento por CSS**
  - *Enfoque elegido:* Retiro completo tanto del DOM (`index.html`), como de los event listeners (`src/events.js`, `src/translator.js`), referencias en el estado (`src/state.js`) y estilos no utilizados (`src/style.css`).
  - *Por qué:* Evita código muerto, posibles excepciones por elementos nulos en el DOM, peticiones innecesarias al servidor y confusión en futuros mantenimientos.
  - *Alternativas consideradas:* Ocultar con `display: none` fue descartado porque conservaría llamadas de red y opciones en desuso.

- **Decisión 2: Compatibilidad de pruebas del servidor**
  - *Enfoque elegido:* Mantener el backend robusto y asegurar que la suite de tests (`npm test`) pase al 100%, actualizando las suites si es necesario o preservando la compatibilidad de los endpoints centrales sin que el cliente dependa de la traducción.
  - *Por qué:* Garantiza la estabilidad total de la aplicación y la confiabilidad del servidor Express y Vite.

---

### 4. Technical Architecture & Data Strategy

#### Diagrama de Arquitectura y Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                       index.html                            │
│  ┌───────────────────────┐       ┌────────────────────────┐ │
│  │   Toolbar Principal   │       │   Modal de Ajustes     │ │
│  │ • Dictar / Reproducir │       │ • Voces y Timbre       │ │
│  │ • Menú IA (✨)        │       │ • Guardado automático  │ │
│  │ • Guardar / Borrar    │       │ • Respaldo / WhatsApp  │ │
│  │ • Ajustes (⚙️)         │       └────────────────────────┘ │
│  └───────────────────────┘                                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │    src/events.js & state.js   │
               │ • Gestión limpia de eventos   │
               │ • Sin referencias a translator│
               └───────────────┬───────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
┌───────▼────────────────────────┐    ┌───────────────▼───────────────┐
│           src/ai.js            │    │       src/notes.js & UI       │
│ • format_dictation             │    │ • Guardado local/IndexedDB    │
│ • summarize                    │    │ • Renderizado de carpetas     │
│ • extract_tasks                │    │ • Historial de notas          │
│ • suggest_title                │    │ • Síntesis y dictado de voz   │
└────────────────────────────────┘    └───────────────────────────────┘
```

#### Mapeo de Componentes a Modificar

1. **`index.html`:**
   - Eliminar el botón `<button class="btn btn-translate" id="translateBtn">` de la barra de herramientas.
   - Eliminar el bloque `<div class="settings-section">` con título «🌐 Idioma de traducción» y el selector `#translateTargetSelect`.
2. **`src/state.js`:**
   - Retirar las propiedades `translateBtn` y `translateTargetSelect` de la lista de elementos DOM cacheados.
3. **`src/events.js`:**
   - Retirar la importación de `initTranslatorEvents` y su invocación.
   - Limpiar el branch específico de `currentAiAction === 'translate'` en los botones de agregar/reemplazar contenido del modal.
4. **`src/style.css`:**
   - Limpiar las clases de estilo `.btn-translate` y sus variantes de estado/hover.
5. **Verificación y Compilación:**
   - Ejecutar `compile_applet`, `lint_applet` y suite de tests para asegurar cero regresiones.
