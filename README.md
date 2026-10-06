# 🎙️ Bitácora Hablada 2.0

> **Escribe · Escucha · Guarda**  
> Una aplicación web progresiva (**PWA**) y moderna para la captura rápida, dictado por voz, organización inteligente y lectura en voz alta de notas personales y profesionales.

Diseñada con filosofía **Local-First**, incluye persistencia en el dispositivo, soporte sin conexión, un asistente de productividad impulsado por **Google Gemini** y un diseño editorial con modo claro y oscuro.

---

## ✨ Características Principales

### 🎙️ Dictado por Voz Inteligente (Mobile & Desktop)
- **Transcripción en tiempo real** mediante la Web Speech API (`SpeechRecognition`).
- **Motor anti-duplicación móvil**: Filtro especializado para corregir comportamientos de navegadores móviles (Chrome Android / WebKit iOS), eliminando repeticiones involuntarias y desfases de audio.
- Compatible con dictado continuo y detección de pausas naturales.

### 🏷️ Títulos Dedicados & Detección Inteligente
- **Campo de título opcional** en la parte superior del editor para organizar tus ideas fácilmente.
- Si no asignas un título manualmente, el sistema detecta de forma inteligente la primera línea o puedes usar el Asistente IA para sugerir uno automáticamente.

### ✨ Asistente IA de Productividad (Gemini)
Integrado directamente en el editor y respaldado por un backend seguro con `@google/genai`:
- **✍️ Puntuar y pulir dictado**: Añade comas, puntos, mayúsculas y párrafos limpios sin alterar tus palabras ni modismos.
- **💡 Sugerir título**: Analiza la nota y genera un título descriptivo y conciso (máximo 6 palabras).
- **📝 Resumir ideas clave**: Sintetiza notas extensas en viñetas claras y accionables.
- **✅ Extraer tareas pendientes**: Identifica compromisos, fechas o acciones pendientes y crea una lista de pendientes.
- **Fallback local inteligente**: En caso de no tener conexión a internet o saturación temporal del servicio, la app aplica reglas de puntuación y extracción local para no interrumpir tu flujo de trabajo.

### 🗣️ Síntesis de Voz Personalizable (Lectura en voz alta)
- Lectura de notas con control de reproducción y ondas de voz interactivas.
- **Filtro de género de voz**: Cambia rápidamente entre voces masculinas, femeninas o todas las disponibles en tu sistema operativo.
- **Ajuste de tono / timbre**: Voces muy graves, graves, naturales o agudas.
- **Botón de prueba rápida**: Escucha una muestra del tono seleccionado antes de aplicar los cambios.

### 📁 Organización y Gestión de Notas
- **Carpetas personalizables**: Crea y organiza notas por proyectos, temas o áreas personales.
- **Papelera de reciclaje**: Recupera notas eliminadas o vacíala definitivamente cuando lo desees.
- **Mover notas**: Mueve notas entre carpetas con un solo toque desde el menú contextual.
- **Vistas adaptables**: Alterna entre **Vista previa detallada** (con extracto y estadísticas) y **Vista compacta de lista**.
- **Ordenamiento flexible**: Ordena tus notas por fecha reciente, más antigua o alfabético (A-Z).
- **Búsqueda instantánea y global**: Busca por palabras clave dentro de la carpeta activa o activa el interruptor para buscar en **todas las carpetas** simultáneamente.

### 📲 Compartir en WhatsApp
- Comparte el título y contenido de cualquier nota directamente en un chat o contacto de WhatsApp con un solo clic, tanto desde el editor como desde la vista previa y la configuración.

### 📦 Copia de Seguridad y Respaldo
- **Ubicación centralizada**: Integrada dentro del panel de **⚙️ Configuración** para mantener la barra lateral limpia y enfocada.
- **Exportar respaldo (.json)**: Guarda todas tus carpetas y notas en un archivo seguro en tu dispositivo.
- **Importar respaldo (.json)**: Restaura tus notas y carpetas previas sin perder la información existente.

### 💾 Guardado Automático (Autosave)
- Guardado instantáneo con *debounce* en `localStorage`.
- Opción de activar o desactivar el guardado automático según tus preferencias desde Configuración.

### 📱 PWA & Modo Offline
- **Instalable** en dispositivos móviles (Android / iOS) y computadoras de escritorio (Chrome, Edge, Safari).
- **Service Worker** con caché inteligente para cargar la interfaz y acceder a todas tus notas incluso sin conexión a internet.

### 🎨 Diseño Editorial & Accesibilidad
- Tipografía editorial combinando **Fraunces** para títulos y **Inter** / **IBM Plex Mono** para lectura clara.
- **Tema Claro / Oscuro**: Alterna con un solo toque; el tema seleccionado se memoriza automáticamente.
- Animación de forma de onda (*waveform*) sincronizada con la lectura y dictado.

---

## 📂 Estructura del Proyecto

```text
bitacora-hablada/
├── .gitignore              # Archivos y carpetas ignorados por Git
├── index.html              # Estructura principal, modales y panel de configuración
├── vite.config.js          # Configuración de empaquetado Vite con middleware dev
├── server.js               # Servidor de producción Express con rate limit, trust proxy y proxy de IA
├── server/
│   ├── aiService.js        # Integración con Google Gen AI SDK (@google/genai)
│   ├── fallbacks.js        # Lógica de fallback local para modo offline / sin API
│   └── validate.js         # Validación compartida de tamaño, formato y lista blanca para /api/ai
├── src/
│   ├── main.js             # Lógica de la aplicación (dictado, notas, carpetas, voz, eventos)
│   └── style.css           # Estilos completos, temas claro/oscuro y diseño responsivo
├── public/
│   ├── manifest.json       # Manifiesto de la PWA
│   ├── sw.js               # Service Worker v2.3.1 con caché offline inteligente por stem
│   ├── icon.svg            # Icono vectorial para propósitos estándar (any)
│   ├── icon-maskable.svg   # Icono vectorial full-bleed para propósitos maskable en Android
│   ├── icon-192.png        # Icono de la aplicación (192x192)
│   └── icon-512.png        # Icono de la aplicación (512x512)
├── tests/
│   ├── aiService.test.js        # Pruebas unitarias de los fallbacks locales
│   ├── aiService.client.test.js # Pruebas unitarias del cliente de IA, reintentos y centinela
│   └── validate.test.js         # Pruebas unitarias de validación y límites de /api/ai
├── .env.example            # Plantilla de variables de entorno (GEMINI_API_KEY, GEMINI_MODEL, TRUST_PROXY)
├── eslint.config.js        # Configuración de ESLint (flat config)
├── package.json            # Dependencias y scripts de ejecución
├── package-lock.json       # Árbol de dependencias bloqueado de npm
├── LICENSE                 # Licencia MIT (2026 Yeremy Briones Herrera)
└── README.md               # Documentación del proyecto
```

---

## 🚀 Requisitos y Configuración

### Prerrequisitos
- **Node.js** 18.0 o superior
- **npm**

### 1. Clonar el repositorio
```bash
git clone https://github.com/Yeremy-B/BITACORA-HABLADA-2.0.git
cd BITACORA-HABLADA-2.0
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno (Opcional para Asistente IA)
Crea un archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

Configura tus credenciales y modelo deseado si ejecutas el backend con IA:
```env
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-3.8-flash
TRUST_PROXY=1
```
- `GEMINI_API_KEY`: Clave de API de Google Gemini (inyectada automáticamente en Google AI Studio).
- `GEMINI_MODEL`: Modelo de Gemini a emplear (por defecto `gemini-3.8-flash`).
- `TRUST_PROXY`: Número de proxies reversos delante del servidor (1 para Cloud Run, Nginx o plataformas serverless; 0 para exposición directa). Permite que el limitador de tasa (`express-rate-limit`) calcule correctamente la IP del cliente y no la del balanceador de carga.

---

## 💻 Ejecución y Pruebas

### Modo Desarrollo (Vite)
Para desarrollo rápido con recarga de interfaz:
```bash
npm run dev
```
Abre en tu navegador `http://localhost:3000`.

### Pruebas Unitarias
Ejecuta la suite de pruebas nativa de Node.js para verificar los fallbacks de IA:
```bash
npm test
```

### Verificación de Código (Linter)
Verifica la calidad y sintaxis del código con ESLint:
```bash
npm run lint
```

### Compilación y Servidor de Producción (Full-Stack)
Para compilar la aplicación y servirla con el proxy de Express:
```bash
# 1. Compilar archivos estáticos optimizados
npm run build

# 2. Iniciar el servidor
npm start
```
El servidor quedará disponible en `http://localhost:3000` con soporte completo para la API de IA, protección contra abuso de tasa (`express-rate-limit`) y fallback SPA.

---

## 🔒 Privacidad y Almacenamiento Local

- **Tus datos te pertenecen**: Todas las notas y carpetas se guardan exclusivamente en el almacenamiento local de tu navegador (`localStorage`).
- **Sin rastreo ni cuentas obligatorias**: La app funciona de forma privada y autónoma sin necesidad de registrar un usuario.
- **Tipografías externas**: Las fuentes tipográficas (*Fraunces*, *Inter* e *IBM Plex Mono*) se descargan desde la CDN pública de Google Fonts (`fonts.googleapis.com` y `fonts.gstatic.com`).
- **Uso de IA transparente**: El texto de las notas solo se envía al servidor cuando presionas explícitamente una de las acciones del botón **✨ Asistente IA**. Si la IA no está disponible o falla, la app aplica automáticamente una versión simplificada local sin interrumpir tu experiencia.

---

## 🌐 Despliegue

La aplicación está lista para desplegarse en:
- **Cloud Run / Docker / VPS**: Ejecutando `npm run build && npm start`.
- **Hosting estático (Vercel, Netlify, GitHub Pages)**: El front-end estático compilado en `dist/` puede servirse en cualquier servidor estático; las notas, dictado y lectura continuarán funcionando al 100% en modo local-first.

---

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE). Puedes usarlo, modificarlo y distribuirlo libremente.
