/** ConversationStore adapter that persists through the existing backend (per-account, JWT). Drop-in replacement for MemoryConversationStore. */
export class BackendConversationStore {
  #map = new Map();   // local conversation id -> { remoteId, sent, status }
  constructor(client) { if (!client?.configured) throw new Error("BackendClient no configurado."); this.client = client; }
  async save(c) {
    let e = this.#map.get(c.id);
    if (!e) { const r = await this.client.createConversation({ title: c.title.slice(0, 120), dataset_ref: c.datasetId ? String(c.datasetId).slice(0, 64) : null }); e = { remoteId: r.id, sent: 0, status: "open" }; this.#map.set(c.id, e); }
    for (const m of c.messages.slice(e.sent)) { await this.client.addConversationMessage(e.remoteId, { role: m.role === "system" ? "assistant" : m.role, content: m.content, meta: m.meta ?? {} }); e.sent++; }
    if (c.status !== e.status) { await (c.status === "closed" ? this.client.closeConversation(e.remoteId) : this.client.reopenConversation(e.remoteId)); e.status = c.status; }
    return c.id;
  }
  async load(id) {
    const r = await this.client.getConversation(id); if (!r) return null;
    const c = { id: r.id, title: r.title, datasetId: r.dataset_ref, createdAt: r.created_at, updatedAt: r.updated_at, status: r.status, messages: r.messages.map(m => ({ id: m.id, role: m.role, content: m.content, at: m.at, meta: m.meta ?? {} })) };
    this.#map.set(c.id, { remoteId: r.id, sent: c.messages.length, status: r.status }); return c;
  }
  async list() { return (await this.client.listConversations()).map(r => ({ id: r.id, title: r.title, datasetId: r.dataset_ref, updatedAt: r.updated_at, status: r.status })); }
}
