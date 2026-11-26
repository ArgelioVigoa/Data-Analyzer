import { AIProvider } from "../provider-interface.js";
/**
 * MOCK AI PROVIDER — TEST TOOL ONLY. It is NOT an AI: it returns fixed, templated text so that the conversation,
 * context, prompt and response pipeline can be exercised without any external service. It never interprets the data.
 */
export const MOCK_BANNER = "[MOCK · HERRAMIENTA DE PRUEBAS · no es una IA]";
export class MockProvider extends AIProvider {
  get id() { return "mock"; }
  get label() { return "Mock (solo pruebas de arquitectura)"; }
  get isMock() { return true; }
  get transport() { return "browser"; }
  async generate({ messages = [], context = {} }) {
    const last = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
    const ds = context.dataset;
    const text = `${MOCK_BANNER}\nRespuesta de prueba con plantilla fija; no se ha analizado su mensaje.\n` +
      `• Mensajes recibidos: ${messages.length} (último del usuario: ${last.length} caracteres).\n` +
      (ds ? `• Contexto recibido: «${ds.name}», fuente ${ds.sourceType}, ${ds.nEvents} eventos, ${context.indicators?.length ?? 0} indicadores.` : "• Sin conjunto de datos en el contexto.");
    return { text, provider: this.id, model: "mock-template-v0", isMock: true, usage: { inputChars: messages.reduce((n, m) => n + m.content.length, 0), outputChars: text.length } };
  }
}
