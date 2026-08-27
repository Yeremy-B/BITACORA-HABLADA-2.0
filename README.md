# 🎙️ Bitácora Hablada (v1.1.0)

Una aplicación web progresiva (**PWA**) y moderna para la captura, organización y reproducción de notas mediante **dictado y síntesis de voz inteligente**. Diseñada para funcionar sin conexión, con persistencia local y soporte multiplataforma (móvil, tablet y escritorio).

---

## ✨ Características Principales

- 🎙️ **Dictado por Voz Continuo**: Captura de pensamientos y notas en tiempo real usando la API nativa de `SpeechRecognition` (Web Speech API).
- 🔊 **Lectura de Notas en Voz Alta**: Síntesis de voz (`SpeechSynthesis`) con soporte para múltiples voces en español y control de reproducción.
- 📁 **Organización por Carpetas**: Clasifica tus notas por categorías, proyectos o temas personalizados.
- 🗑️ **Papelera de Reciclaje**: Recuperación de notas y carpetas eliminadas por accidente.
- 🏷️ **Etiquetado y Búsqueda Rápida**: Filtrado instantáneo por texto, etiquetas (#tags) y fechas.
- 📥/📤 **Respaldo y Restauración**: Exporta e importa todas tus notas en formato JSON en cualquier momento.
- 📱 **PWA (Progressive Web App)**: Instalable en dispositivos móviles y de escritorio, optimizada para funcionar 100% offline mediante Service Workers.
- 🎨 **Diseño Editorial & Temas**: Interfaz limpia con tipografía cuidada, paleta de colores cálidos y modos de lectura cómodos.

---

## 📂 Estructura del Proyecto

```text
bitacora-hablada/
├── index.html          # Estructura principal y marcado semántico
├── src/
│   ├── style.css       # Estilos, variables CSS, animaciones y diseño responsivo
│   └── main.js         # Lógica de la app (reconocimiento de voz, carpetas, notas, eventos)
├── public/
│   ├── manifest.json   # Configuración para instalación PWA
│   ├── sw.js           # Service Worker para funcionamiento sin conexión
│   ├── icon-192.png    # Icono de la app (192x192)
│   └── icon-512.png    # Icono de la app (512x512)
├── package.json        # Configuración del proyecto y scripts
└── README.md           # Documentación del proyecto
```

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
cd TU_REPOSITORIO
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo
```bash
npm run dev
```

Abre tu navegador en `http://localhost:3000` (o el puerto indicado en la consola).

### 4. Compilar para Producción
```bash
npm run build
```
Los archivos optimizados se generarán en la carpeta `dist/`, listos para subirse a GitHub Pages, Vercel, Netlify o cualquier hosting web estático.

---

## 🌐 Despliegue en GitHub Pages

1. En tu repositorio de GitHub, ve a **Settings** > **Pages**.
2. En la sección **Build and deployment**, selecciona la fuente (Branch `main` o GitHub Actions).
3. ¡Listo! Tu app estará disponible en una URL pública de forma gratuita.

---

## 🔒 Privacidad y Almacenamiento

- Tus notas se guardan de forma local en tu propio navegador (`localStorage` / `IndexedDB`).
- El reconocimiento de voz utiliza los servicios del navegador con permisos explícitos del usuario.
- No se envían datos personales a servidores de terceros sin tu autorización.

---

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia [MIT](LICENSE).
