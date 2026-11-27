import { assertProvider } from "./provider-interface.js";
export class ProviderManager {
  #providers = new Map(); #active = null;
  register(provider) { assertProvider(provider); if (this.#providers.has(provider.id)) throw new Error(`Proveedor ya registrado: ${provider.id}`); this.#providers.set(provider.id, provider); if (!this.#active) this.#active = provider.id; return this; }
  unregister(id) { this.#providers.delete(id); if (this.#active === id) this.#active = [...this.#providers.keys()][0] ?? null; }
  list() { return [...this.#providers.values()].map(p => ({ id: p.id, label: p.label, isMock: p.isMock, transport: p.transport, active: p.id === this.#active })); }
  setActive(id) { if (!this.#providers.has(id)) throw new Error(`Proveedor no registrado: ${id}`); this.#active = id; }
  get active() { if (!this.#active) throw new Error("No hay ningún proveedor de IA registrado."); return this.#providers.get(this.#active); }
}
