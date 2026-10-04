/**
 * JSON listo para incrustar en `<script type="application/json" set:html>`.
 * `JSON.stringify` no escapa `<`, así que un texto con `</script>` cerraría la etiqueta.
 * @param {unknown} value
 * @returns {string}
 */
export function jsonForScript(value) {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
}
