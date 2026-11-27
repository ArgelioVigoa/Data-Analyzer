/** Versioned prompt templates. Text only — prepared for the future scientific interview; not executed against a model here. */
const T = {
  "system.scientific-assistant/v0": "Eres un asistente científico para datos de transporte de neutrones. Usa EXCLUSIVAMENTE el contexto proporcionado. No inventes valores, referencias ni resultados. Distingue siempre entre simulación GEANT4, modelo demostrativo propio y datos manuales según el campo «sourceType». Si falta información, pregunta. Idioma: {{language}}.",
  "interview.opening/v0": "Describe brevemente el conjunto «{{datasetName}}» ({{nEvents}} eventos) y pregunta al investigador qué desea estudiar."
};
export class PromptManager {
  #t = new Map(Object.entries(T));
  register(id, template) { if (!/^[\w.-]+\/v\d+$/.test(id)) throw new Error("El id debe tener la forma nombre/vN"); if (this.#t.has(id)) throw new Error(`Plantilla ya existente: ${id}`); this.#t.set(id, String(template)); }
  list() { return [...this.#t.keys()]; }
  render(id, vars = {}) {
    const t = this.#t.get(id); if (t === undefined) throw new Error(`Plantilla desconocida: ${id}`);
    return t.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in vars)) throw new Error(`Falta la variable «${k}» para ${id}`); return String(vars[k]); });
  }
}
