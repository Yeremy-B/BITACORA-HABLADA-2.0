import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackFormatDictation,
  fallbackSuggestTitle,
  fallbackSummarize,
  fallbackExtractTasks,
  fallbackTitleAndTags,
  applyFallback
} from '../server/fallbacks.js';

describe('Fallback Local de IA (server/fallbacks.js)', () => {
  test('fallbackFormatDictation agrega mayúscula y punto final si faltan', () => {
    const input = 'esta es una nota de prueba sin punto';
    const output = fallbackFormatDictation(input);
    assert.equal(output, 'Esta es una nota de prueba sin punto.');

    const alreadyPunctuated = '¡Hola mundo!';
    assert.equal(fallbackFormatDictation(alreadyPunctuated), '¡Hola mundo!');

    assert.equal(fallbackFormatDictation(''), '');
  });

  test('fallbackSuggestTitle genera un título conciso basado en la primera línea', () => {
    const input = '# Plan de trabajo para el proyecto anual\nDetalle secundario aquí...';
    const title = fallbackSuggestTitle(input);
    assert.equal(title, 'Plan de trabajo para el proyecto');

    assert.equal(fallbackSuggestTitle(''), '');
  });

  test('fallbackSummarize extrae hasta 3 oraciones con viñetas', () => {
    const text = 'Primera idea importante. Segunda consideración clave. Tercer aspecto relevante. Cuarto detalle menor.';
    const summary = fallbackSummarize(text);
    const lines = summary.split('\n');
    assert.equal(lines.length, 3);
    assert.ok(lines[0].startsWith('• '));
    assert.ok(lines[1].startsWith('• '));
    assert.ok(lines[2].startsWith('• '));

    assert.equal(fallbackSummarize(''), '');
  });

  test('fallbackExtractTasks extrae tareas con palabras clave y NO inventa tareas si no hay', () => {
    const withTasks = 'Comprar materiales para el taller\nLlamar al cliente a las 3\nRevisar informe de ventas\nTexto narrativo sin acción.';
    const tasks = fallbackExtractTasks(withTasks);
    assert.ok(tasks.includes('• Comprar materiales para el taller'));
    assert.ok(tasks.includes('• Llamar al cliente a las 3'));
    assert.ok(tasks.includes('• Revisar informe de ventas'));
    assert.ok(!tasks.includes('Texto narrativo'));

    // Verificación crucial: no inventar "Revisar notas pendientes"
    const withoutTasks = 'Este es un texto puramente descriptivo sobre una tarde en el campo.';
    const emptyTasks = fallbackExtractTasks(withoutTasks);
    assert.equal(emptyTasks, '');
    assert.ok(!emptyTasks.includes('Revisar notas pendientes'));
  });

  test('fallbackTitleAndTags devuelve título vacío y tags vacíos si el JSON no es válido', () => {
    const res = fallbackTitleAndTags('texto', 'no es un json');
    assert.equal(res.title, '');
    assert.deepEqual(res.tags, []);
    assert.equal(res.fallback, true);

    const validRes = fallbackTitleAndTags('texto', '{"title": "Mi Título", "tags": ["tag1"]}');
    assert.equal(validRes.title, 'Mi Título');
    assert.deepEqual(validRes.tags, ['tag1']);
    assert.equal(validRes.fallback, true);
  });

  test('applyFallback incluye siempre fallback: true en todas las acciones', () => {
    const actions = ['format_dictation', 'suggest_title', 'summarize', 'extract_tasks', 'title_and_tags'];
    for (const act of actions) {
      const res = applyFallback(act, 'Nota de prueba para verificar fallback.');
      assert.equal(res.fallback, true, `La acción ${act} debe retornar fallback: true`);
    }
  });
});
