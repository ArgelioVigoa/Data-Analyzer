/**
 * Provider contract. Every model backend (future: Gemini, Groq, OpenRouter, Ollama…) is an adapter implementing this.
 * Adapters that need a secret MUST be remote (called through the Data Analyzer backend) — browsers never hold API keys.
 *
 * generate(request) -> Promise<ProviderResponse>
 *   request  = { messages:[{role:"system"|"user"|"assistant", content:string}], context:object, settings:object, signal?:AbortSignal }
 *   response = { text:string, provider:string, model:string, isMock:boolean, usage?:{inputChars:number,outputChars:number}, structured?:object }
 */
export const ROLES = Object.freeze(["system", "user", "assistant"]);
export class AIProvider {
  get id() { throw new Error("AIProvider.id not implemented"); }
  get label() { throw new Error("AIProvider.label not implemented"); }
  /** true => test double, never a real model. Shown in the UI and carried in every response. */
  get isMock() { return false; }
  /** "browser" providers run locally without secrets; "remote" ones go through the backend proxy. */
  get transport() { return "remote"; }
  get capabilities() { return Object.freeze({ streaming: false, structuredOutput: false }); }
  async generate(_request) { throw new Error("AIProvider.generate not implemented"); }
}
/** Structural check used by the Provider Manager (duck typing, so adapters need not extend the class). */
export function assertProvider(p) {
  const problems = [];
  if (!p || typeof p !== "object") throw new TypeError("El proveedor debe ser un objeto.");
  for (const k of ["id", "label"]) if (typeof p[k] !== "string" || !p[k]) problems.push(`falta «${k}» (cadena)`);
  if (typeof p.isMock !== "boolean") problems.push("«isMock» debe ser booleano");
  if (!["browser", "remote"].includes(p.transport)) problems.push("«transport» debe ser «browser» o «remote»");
  if (typeof p.generate !== "function") problems.push("falta «generate(request)»");
  if (problems.length) throw new TypeError(`Proveedor no válido: ${problems.join("; ")}.`);
  return p;
}
