import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { processNoteWithAI } from './server/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// Endpoint de la IA productiva
app.post('/api/ai', async (req, res) => {
  try {
    const { action, text } = req.body;
    if (!action || !text) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (action, text).' });
    }
    const result = await processNoteWithAI(action, text);
    res.json(result);
  } catch (err) {
    console.error('[API AI Error]:', err);
    res.status(500).json({
      error: err.message || 'Error al procesar la solicitud con IA.'
    });
  }
});

// Servir archivos estáticos del build (dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[Bitácora Hablada] Servidor ejecutándose en http://0.0.0.0:${port}`);
});
