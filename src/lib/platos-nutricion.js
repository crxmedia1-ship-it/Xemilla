/**
 * Parse / apply nutrition fields for platos APIs.
 */
import { normalizeAlergias, parseMacroInt } from '../config/nutricion.js';

/**
 * @param {Record<string, unknown>} raw
 * @param {Record<string, unknown>} patch
 */
export function applyNutricionPatch(raw, patch) {
  if (raw.calorias !== undefined) patch.calorias = parseMacroInt(raw.calorias);
  if (raw.proteinas !== undefined) patch.proteinas = parseMacroInt(raw.proteinas);
  if (raw.carbs !== undefined) patch.carbs = parseMacroInt(raw.carbs);
  if (raw.grasas !== undefined) patch.grasas = parseMacroInt(raw.grasas);
  if (raw.alergias !== undefined) patch.alergias = normalizeAlergias(raw.alergias);
  if (typeof raw.ingredientes_detalle === 'string') {
    patch.ingredientes_detalle = raw.ingredientes_detalle.trim() || null;
  } else if (raw.ingredientes_detalle === null) {
    patch.ingredientes_detalle = null;
  }
}

/**
 * @param {Record<string, unknown>} raw
 */
export function pickNutricionInsert(raw) {
  /** @type {Record<string, unknown>} */
  const out = {};
  applyNutricionPatch(raw, out);
  return out;
}
