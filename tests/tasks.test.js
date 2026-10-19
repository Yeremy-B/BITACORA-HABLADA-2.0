import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasTasks,
  getTaskStats,
  toggleTaskByIndex,
  TASK_REGEX
} from '../src/tasks.js';

describe('Módulo de Tareas Interactivas (src/tasks.js)', () => {
  test('hasTasks detecta correctamente si un texto contiene casillas [ ] o [x]', () => {
    assert.equal(hasTasks('Nota normal sin tareas'), false);
    assert.equal(hasTasks('[ ] Tarea pendiente'), true);
    assert.equal(hasTasks('[x] Tarea completada'), true);
    assert.equal(hasTasks('- [ ] Tarea con viñeta de guion'), true);
    assert.equal(hasTasks('* [x] Tarea con asterisco'), true);
    assert.equal(hasTasks('Texto arriba\n[ ] Tarea en segunda línea\nTexto abajo'), true);
  });

  test('getTaskStats calcula total, completadas y porcentaje correctamente', () => {
    const text = `
Nota con tareas:
[ ] Comprar leche
[x] Enviar informe
[ ] Llamar al doctor
[x] Pagar servicios
    `;
    const stats = getTaskStats(text);
    assert.equal(stats.total, 4);
    assert.equal(stats.completed, 2);
    assert.equal(stats.percent, 50);

    const empty = getTaskStats('Sin tareas');
    assert.equal(empty.total, 0);
    assert.equal(empty.completed, 0);
    assert.equal(empty.percent, 0);

    const allDone = getTaskStats('[x] Una\n[x] Dos');
    assert.equal(allDone.total, 2);
    assert.equal(allDone.completed, 2);
    assert.equal(allDone.percent, 100);
  });

  test('toggleTaskByIndex alterna entre [ ] y [x] según el índice', () => {
    const initial = '[ ] Tarea 1\n[x] Tarea 2\n[ ] Tarea 3';

    // Marcar la tarea 0 como completada
    const updated1 = toggleTaskByIndex(initial, 0);
    assert.ok(updated1.includes('[x] Tarea 1'));
    assert.ok(updated1.includes('[x] Tarea 2'));
    assert.ok(updated1.includes('[ ] Tarea 3'));

    // Desmarcar la tarea 1
    const updated2 = toggleTaskByIndex(updated1, 1);
    assert.ok(updated2.includes('[x] Tarea 1'));
    assert.ok(updated2.includes('[ ] Tarea 2'));
    assert.ok(updated2.includes('[ ] Tarea 3'));
  });

  test('TASK_REGEX detecta variantes con mayúsculas y espacios', () => {
    assert.ok(TASK_REGEX.test('[ ] Tarea simple'));
    assert.ok(TASK_REGEX.test('[x] Tarea completada'));
    assert.ok(TASK_REGEX.test('[X] Tarea con X mayúscula'));
    assert.ok(TASK_REGEX.test('  - [ ] Tarea indentada'));
    assert.ok(TASK_REGEX.test('* [x] Tarea con asterisco'));
  });
});
