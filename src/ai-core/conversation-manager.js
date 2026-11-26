/** Conversations: ordered messages bound to a dataset id, serialisable, with a pluggable store (memory now, backend later). */
const uid = () => globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const LIMITS = Object.freeze({ maxMessages: 200, maxChars: 8000 });
export class MemoryConversationStore {
  #m = new Map();
  async save(c) { this.#m.set(c.id, structuredClone(c)); return c.id; }
  async load(id) { return this.#m.has(id) ? structuredClone(this.#m.get(id)) : null; }
  async list() { return [...this.#m.values()].map(({ id, title, datasetId, updatedAt, status }) => ({ id, title, datasetId, updatedAt, status })); }
}
export class ConversationManager {
  constructor(store = new MemoryConversationStore()) { this.store = store; this.current = null; }
  async start({ datasetId = null, title = "Nueva conversación" } = {}) {
    const now = new Date().toISOString();
    this.current = { id: uid(), title, datasetId, createdAt: now, updatedAt: now, status: "open", messages: [] };
    await this.store.save(this.current); return this.current;
  }
  async add(role, content, meta = {}) {
    const c = this.current; if (!c) throw new Error("No hay conversación abierta.");
    if (c.status !== "open") throw new Error("La conversación está cerrada.");
    if (!["user", "assistant", "system"].includes(role)) throw new Error("Rol no válido.");
    if (typeof content !== "string" || !content.trim()) throw new Error("El mensaje está vacío.");
    if (content.length > LIMITS.maxChars) throw new Error(`Mensaje demasiado largo (máx. ${LIMITS.maxChars}).`);
    if (c.messages.length >= LIMITS.maxMessages) throw new Error("La conversación alcanzó el máximo de mensajes.");
    const m = { id: uid(), role, content, at: new Date().toISOString(), meta }; c.messages.push(m); c.updatedAt = m.at;
    await this.store.save(c); return m;
  }
  async close() { if (this.current) { this.current.status = "closed"; await this.store.save(this.current); } }
  async resume(id) { const c = await this.store.load(id); if (!c) throw new Error("Conversación no encontrada."); c.status = "open"; this.current = c; await this.store.save(c); return c; }
}
