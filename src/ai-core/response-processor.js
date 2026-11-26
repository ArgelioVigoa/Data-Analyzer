/** Validates and normalises provider output. Text is returned as PLAIN TEXT (rendered with textContent, never as HTML). */
const MAX = 20000;
export function processResponse(resp, { expectedProvider } = {}) {
  const warnings = [];
  if (!resp || typeof resp !== "object") throw new Error("Respuesta del proveedor no válida.");
  if (typeof resp.text !== "string") throw new Error("La respuesta no contiene texto.");
  if (typeof resp.isMock !== "boolean") throw new Error("La respuesta no indica si procede de un proveedor de pruebas (isMock).");
  if (expectedProvider && resp.provider !== expectedProvider) throw new Error("La respuesta procede de un proveedor distinto del solicitado.");
  let text = resp.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  if (text.length > MAX) { text = text.slice(0, MAX); warnings.push("Respuesta truncada por longitud."); }
  if (!text.trim()) warnings.push("Respuesta vacía.");
  return { text, provider: String(resp.provider), model: String(resp.model ?? ""), isMock: resp.isMock, structured: resp.structured && typeof resp.structured === "object" ? resp.structured : null, usage: resp.usage ?? null, warnings };
}
