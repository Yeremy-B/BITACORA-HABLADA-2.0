/**
 * Validación compartida para peticiones al endpoint /api/ai
 * Utilizada tanto en server.js (Express) como en vite.config.js (Vite dev middleware)
 */

export const MAX_TEXT_LENGTH = 20000;

export function validateAIRequest(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      status: 400,
      error: 'Cuerpo de la solicitud inválido.'
    };
  }

  const { action, text } = data;

  if (typeof action !== 'string' || !action.trim()) {
    return {
      valid: false,
      status: 400,
      error: 'El parámetro "action" es requerido y debe ser una cadena de texto válida.'
    };
  }

  if (typeof text !== 'string' || !text.trim()) {
    return {
      valid: false,
      status: 400,
      error: 'El parámetro "text" es requerido y debe ser una cadena de texto no vacía.'
    };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      status: 413,
      error: `El texto excede el límite máximo permitido de 20.000 caracteres (recibidos: ${text.length}).`
    };
  }

  return {
    valid: true,
    action: action.trim(),
    text
  };
}
