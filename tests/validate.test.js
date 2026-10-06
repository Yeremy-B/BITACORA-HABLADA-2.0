import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateAIRequest, VALID_ACTIONS, MAX_TEXT_LENGTH } from '../server/validate.js';

describe('Validación de Peticiones AI (server/validate.js)', () => {
  test('cuerpo null o no objeto devuelve status 400', () => {
    const resNull = validateAIRequest(null);
    assert.equal(resNull.valid, false);
    assert.equal(resNull.status, 400);

    const resUndefined = validateAIRequest(undefined);
    assert.equal(resUndefined.valid, false);
    assert.equal(resUndefined.status, 400);

    const resString = validateAIRequest('cadena');
    assert.equal(resString.valid, false);
    assert.equal(resString.status, 400);
  });

  test('sin action o action no string devuelve status 400', () => {
    const resNoAction = validateAIRequest({ text: 'Hola' });
    assert.equal(resNoAction.valid, false);
    assert.equal(resNoAction.status, 400);

    const resEmptyAction = validateAIRequest({ action: '   ', text: 'Hola' });
    assert.equal(resEmptyAction.valid, false);
    assert.equal(resEmptyAction.status, 400);

    const resNumberAction = validateAIRequest({ action: 123, text: 'Hola' });
    assert.equal(resNumberAction.valid, false);
    assert.equal(resNumberAction.status, 400);
  });

  test('action desconocida devuelve status 400 y mensaje Acción no soportada', () => {
    const resUnknown = validateAIRequest({ action: 'inventada', text: 'Hola' });
    assert.equal(resUnknown.valid, false);
    assert.equal(resUnknown.status, 400);
    assert.equal(resUnknown.error, 'Acción no soportada.');

    const resHack = validateAIRequest({ action: 'delete_all', text: 'Hola' });
    assert.equal(resHack.valid, false);
    assert.equal(resHack.status, 400);
    assert.equal(resHack.error, 'Acción no soportada.');
  });

  test('text vacío devuelve status 400', () => {
    const resNoText = validateAIRequest({ action: 'summarize' });
    assert.equal(resNoText.valid, false);
    assert.equal(resNoText.status, 400);

    const resEmptyText = validateAIRequest({ action: 'summarize', text: '   ' });
    assert.equal(resEmptyText.valid, false);
    assert.equal(resEmptyText.status, 400);
  });

  test('text de más de 20.000 caracteres devuelve status 413', () => {
    const longText = 'a'.repeat(MAX_TEXT_LENGTH + 1); // 20.001
    const resOver = validateAIRequest({ action: 'summarize', text: longText });
    assert.equal(resOver.valid, false);
    assert.equal(resOver.status, 413);
    assert.ok(resOver.error.includes('20.000 caracteres'));
  });

  test('text de exactamente 20.000 caracteres es válido', () => {
    const exactText = 'a'.repeat(MAX_TEXT_LENGTH); // 20.000
    const resExact = validateAIRequest({ action: 'summarize', text: exactText });
    assert.equal(resExact.valid, true);
    assert.equal(resExact.action, 'summarize');
    assert.equal(resExact.text.length, MAX_TEXT_LENGTH);
  });

  test('petición válida devuelve action sin espacios sobrantes', () => {
    for (const validAction of VALID_ACTIONS) {
      const res = validateAIRequest({ action: `  ${validAction}  `, text: 'Texto de prueba' });
      assert.equal(res.valid, true);
      assert.equal(res.action, validAction);
      assert.equal(res.text, 'Texto de prueba');
    }
  });
});
