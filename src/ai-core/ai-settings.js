/** AI settings: preferences only. Secrets are rejected on purpose — they live in the backend environment. */
export const DEFAULT_SETTINGS = Object.freeze({ activeProvider: "mock", model: "mock-template-v0", maxContextChars: 6000, includeRawData: false, temperature: 0.2, language: "es" });
const SECRET_KEY = /(api[-_]?key|secret|token|password|passwd|authorization|bearer|credential)/i;
const SECRET_VALUE = /(\bsk-[A-Za-z0-9_-]{16,}|\bAIza[0-9A-Za-z_-]{20,}|\bgsk_[A-Za-z0-9]{16,}|\bhf_[A-Za-z0-9]{20,}|\bBearer\s+\S{16,})/;
export class AISettings {
  #v = { ...DEFAULT_SETTINGS };
  get value() { return { ...this.#v }; }
  update(patch = {}) {
    const next = { ...this.#v };
    for (const [k, val] of Object.entries(patch)) {
      if (SECRET_KEY.test(k) || (typeof val === "string" && SECRET_VALUE.test(val))) throw new Error("Las credenciales de proveedores no se guardan en el navegador: configúrelas en el entorno del backend.");
      if (!(k in DEFAULT_SETTINGS)) throw new Error(`Ajuste desconocido: ${k}`);
      next[k] = val;
    }
    if (typeof next.activeProvider !== "string" || !next.activeProvider) throw new Error("activeProvider inválido.");
    if (!Number.isInteger(next.maxContextChars) || next.maxContextChars < 500 || next.maxContextChars > 50000) throw new Error("maxContextChars debe estar entre 500 y 50000.");
    if (typeof next.temperature !== "number" || next.temperature < 0 || next.temperature > 2) throw new Error("temperature debe estar entre 0 y 2.");
    if (typeof next.includeRawData !== "boolean") throw new Error("includeRawData debe ser booleano.");
    this.#v = next; return this.value;
  }
}
