import { defineConfig } from 'vite';
import { processNoteWithAI } from './server/aiService.js';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  plugins: [
    {
      name: 'ai-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/ai', async (req, res, next) => {
          if (req.method !== 'POST') return next();
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { action, text } = data;
              if (!action || !text) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Faltan parámetros requeridos (action, text).' }));
                return;
              }
              const result = await processNoteWithAI(action, text);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err) {
              console.error('[Vite AI Middleware Error]:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Error al procesar solicitud con IA.' }));
            }
          });
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
