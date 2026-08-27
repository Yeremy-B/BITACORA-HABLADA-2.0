# 🎙️ Bitácora Hablada 2.0 (v2.0.0)

Una aplicación web progresiva (**PWA**) y moderna para la captura, organización, dictado y lectura de notas mediante la **Web Speech API** (reconocimiento y síntesis de voz). Diseñada para ofrecer persistencia local, respaldo en JSON y compatibilidad multiplataforma (móvil, tablet y escritorio).

---

## ✨ Características Principales

- 🎙️ **Dictado por Voz**: Transcripción de pensamientos y notas en tiempo real mediante `SpeechRecognition` nativo en español (`es-CL` / idioma local del navegador).
- 💾 **Guardado Automático (Autosave)**: Todo lo que escribes o dictas se guarda automáticamente con debounce en tu carpeta activa sin riesgo de perder cambios.
- 🔊 **Lectura de Notas en Voz Alta**: Síntesis de voz fluida (`SpeechSynthesis`) con selector de voces en español, acentos latinoamericanos y control de reproducción.
- 📁 **Organización por Carpetas**: Clasifica y mueve tus notas entre diferentes categorías o proyectos personalizados.
- 🗑️ **Papelera de Reciclaje**: Recupera notas eliminadas o vacíala definitivamente cuando lo desees (retención temporal de 30 días).
- 🏷️ **Etiquetado y Búsqueda Rápida**: Filtra instantáneamente por texto, etiquetas (#tags) y fechas tanto en la carpeta actual como en todas las carpetas.
- 📥/📤 **Respaldo y Restauración**: Exporta e importa todas tus carpetas y notas en formato JSON con un solo clic.
- 📱 **PWA & Modo Offline**: Instalable en dispositivos Android, iOS y PC de escritorio. Utiliza Service Worker con estrategia de caché inteligente para cargar la interfaz y notas sin conexión a internet.
- 🎨 **Diseño Editorial & Modo Oscuro/Claro**: Interfaz con tipografías Fraunces e IBM Plex Mono, animaciones de onda de sonido y adaptación a cualquier tamaño de pantalla.

---

## 📂 Estructura del Proyecto

```text
bitacora-hablada/
├── index.html          # Estructura principal con rutas relativas compatibles con GitHub Pages
├── vite.config.js      # Configuración de Vite con base relativa './'
├── src/
│   ├── style.css       # Estilos, temas claro/oscuro y diseño responsivo
│   └── main.js         # Lógica de la aplicación (Web Speech API, autosave, carpetas, papelera)
├── public/
│   ├── manifest.json   # Manifiesto PWA para instalación en móviles y PC
│   ├── sw.js           # Service Worker v2.0 con caché inteligente offline
│   ├── icon-192.png    # Icono de la app (192x192)
│   └── icon-512.png    # Icono de la app (512x512)
├── package.json        # Configuración del proyecto y versión 2.0.0
└── README.md           # Documentación técnica del proyecto
```

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Clonar el repositorio
```bash
git clone https://github.com/Yeremy-B/BITACORA-HABLADA-2.0.git
cd BITACORA-HABLADA-2.0
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo
```bash
npm run dev
```

Abre tu navegador en `http://localhost:3000` (o el puerto que indique Vite).

### 4. Compilar para Producción
```bash
npm run build
```
Los archivos optimizados se generarán en la carpeta `dist/` con rutas relativas, listos para desplegar en GitHub Pages, Vercel, Netlify o cualquier servidor web estático.

---

## 🌐 Despliegue en GitHub Pages

Gracias a las rutas relativas (`./`) configuradas en `index.html`, `vite.config.js` y `public/manifest.json`, la app es 100% compatible con subdirectorios de GitHub Pages:

1. En tu repositorio de GitHub, ve a **Settings** > **Pages**.
2. En **Build and deployment**, selecciona la rama donde publicas (o la carpeta `dist` / GitHub Actions).
3. Tu app funcionará en `https://yeremy-b.github.io/BITACORA-HABLADA-2.0/` sin problemas de rutas 404.

---

## 🔒 Privacidad y Almacenamiento

- **Almacenamiento Local**: Todas tus carpetas y notas se guardan de forma privada y local en tu propio navegador mediante `window.localStorage`. No se transfieren a servidores externos.
- **Reconocimiento y Síntesis de Voz**: Utiliza las APIs nativas del navegador (`SpeechRecognition` y `SpeechSynthesis`). Ten en cuenta que la disponibilidad del dictado depende del soporte de tu navegador y dispositivo.

---

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia [MIT](LICENSE).
