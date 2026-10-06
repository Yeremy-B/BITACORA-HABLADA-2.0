import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { processNoteWithAI } from '../server/aiService.js';

describe('Cliente y Lógica de Gemini (server/aiService.js)', () => {
  test('extract_tasks con respuesta SIN_TAREAS devuelve result vacio, fallback false y 1 sola llamada', async () => {
    let callCount = 0;
    const fakeClient = {
      models: {
        generateContent: async () => {
          callCount++;
          return { text: 'SIN_TAREAS' };
        }
      }
    };

    const res = await processNoteWithAI('extract_tasks', 'Texto sin ninguna tarea.', {
      client: fakeClient,
      retryBaseDelay: 5
    });

    assert.equal(callCount, 1, 'Debe realizar exactamente 1 llamada');
    assert.equal(res.action, 'extract_tasks');
    assert.equal(res.result, '');
    assert.equal(res.fallback, false);
  });

  test('extract_tasks con respuesta de tareas devuelve el texto y sin fallback', async () => {
    let callCount = 0;
    const fakeClient = {
      models: {
        generateContent: async () => {
          callCount++;
          return { text: '• Llamar al cliente' };
        }
      }
    };

    const res = await processNoteWithAI('extract_tasks', 'Llamar al cliente a las 5.', {
      client: fakeClient,
      retryBaseDelay: 5
    });

    assert.equal(callCount, 1);
    assert.equal(res.action, 'extract_tasks');
    assert.equal(res.result, '• Llamar al cliente');
    assert.equal(res.fallback, undefined);
  });

  test('cliente que lanza 404 hace 1 sola llamada y devuelve fallback true', async () => {
    let callCount = 0;
    const fakeClient = {
      models: {
        generateContent: async () => {
          callCount++;
          const err = new Error('model not found');
          err.status = 404;
          throw err;
        }
      }
    };

    const res = await processNoteWithAI('suggest_title', 'Nota de prueba para modelo ausente.', {
      client: fakeClient,
      retryBaseDelay: 5
    });

    assert.equal(callCount, 1, 'No debe reintentar tras un error 404');
    assert.equal(res.fallback, true);
    assert.ok(res.title.length > 0);
  });

  test('cliente con error 503 dos veces y exito al 3ro realiza 3 llamadas y no usa fallback', async () => {
    let callCount = 0;
    const fakeClient = {
      models: {
        generateContent: async () => {
          callCount++;
          if (callCount < 3) {
            throw new Error('503 Service Unavailable / High demand');
          }
          return { text: 'Resumen exitoso de la nota' };
        }
      }
    };

    const res = await processNoteWithAI('summarize', 'Texto para resumir que tiene suficiente contenido.', {
      client: fakeClient,
      retryBaseDelay: 10
    });

    assert.equal(callCount, 3, 'Debe reintentar y tener éxito en el tercer intento');
    assert.equal(res.result, 'Resumen exitoso de la nota');
    assert.equal(res.fallback, undefined);
  });

  test('suggest_title con respuesta entre comillas y punto final devuelve título limpio', async () => {
    const fakeClient = {
      models: {
        generateContent: async () => ({
          text: '"Plan semanal."'
        })
      }
    };

    const res = await processNoteWithAI('suggest_title', 'Reunión semanal de planificación.', {
      client: fakeClient,
      retryBaseDelay: 5
    });

    assert.equal(res.title, 'Plan semanal');
    assert.equal(res.fallback, undefined);
  });

  test('title_and_tags con bloque json markdown parsea correctamente', async () => {
    const fakeClient = {
      models: {
        generateContent: async () => ({
          text: '```json\n{"title":"Plan 2026","tags":["estrategia","finanzas"]}\n```'
        })
      }
    };

    const res = await processNoteWithAI('title_and_tags', 'Nota de estrategia financiera.', {
      client: fakeClient,
      retryBaseDelay: 5
    });

    assert.equal(res.action, 'title_and_tags');
    assert.equal(res.title, 'Plan 2026');
    assert.deepEqual(res.tags, ['estrategia', 'finanzas']);
    assert.equal(res.fallback, undefined);
  });
});
