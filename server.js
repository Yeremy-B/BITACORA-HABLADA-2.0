import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { processNoteWithAI } from './server/aiService.js';
import { validateAIRequest } from './server/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// Límite de tasa para proteger la cuota de la API de IA (20 peticiones por minuto por IP)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Has superado el límite de 20 solicitudes por minuto a la IA. Por favor, espera un momento antes de volver a intentar.'
  }
});

// Endpoint de la IA productiva
app.post('/api/ai', aiRateLimiter, async (req, res) => {
  const validation = validateAIRequest(req.body);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  try {
    const result = await processNoteWithAI(validation.action, validation.text);
    res.json(result);
  } catch (err) {
    console.error('[API AI Error]:', err);
    res.status(500).json({
      error: 'No se pudo procesar la solicitud con IA.'
    });
  }
});

// Servir archivos estáticos del build (dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback SPA (compatible con Express 5 y path-to-regexp)
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[Bitácora Hablada] Servidor ejecutándose en http://0.0.0.0:${port}`);
});
