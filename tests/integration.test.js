import test from "node:test"; import assert from "node:assert/strict"; import { execFileSync } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
import { BackendClient } from "../src/services/backend-client.js"; import { BackendConversationStore } from "../src/ai-core/backend-conversation-store.js";
import { AICore, ConversationManager, MockProvider } from "../src/ai-core/index.js"; import { DataSourceManager } from "../src/data/data-source-manager.js"; import { runAnalysis } from "../src/analysis/neutron-service.js";
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
test("every JS file under src/ and assets/ parses", () => { for (const f of [...walk("src"), ...walk("assets")].filter(f => f.endsWith(".js"))) execFileSync(process.execPath, ["--check", f]); });
test("ONE engine and ONE simulator: no second implementation anywhere in src/ (static check)", () => {
  const all = walk("src").filter(f => f.endsWith(".js")), count = re => all.filter(f => re.test(fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map(f => f.replace(/\\/g, "/"));
  assert.deepEqual(count(/export function analyzeDeposition/), ["src/analysis/neutron-engine.js"]); assert.deepEqual(count(/export function runNeutronDemo/), ["src/simulation/neutron-demo.js"]);
  assert.deepEqual(count(/function wilsonInterval/), ["src/analysis/neutron-engine.js"]); assert.deepEqual(count(/runNeutronDemo\(/), ["src/data/data-source-manager.js", "src/simulation/neutron-demo.js"]);
  assert.deepEqual(count(/analyzeDeposition\(/).filter(f => !f.includes("neutron-engine")), ["src/analysis/neutron-service.js"]);   // UI/AI go through the service only
  assert.ok(!count(/quantile\(/).some(f => f.startsWith("src/ui") || f.startsWith("src/ai-core")), "UI/AI must not compute statistics themselves");
});
test("UI never uses innerHTML (all text goes through textContent)", () => { for (const f of walk("src/ui")) assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), f); });
test("no API keys or provider secrets in the frontend code", () => { for (const f of walk("src").filter(f => f.endsWith(".js"))) assert.ok(!/(\bsk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|\bgsk_[A-Za-z0-9]{16,}|\bhf_[A-Za-z0-9]{20,})/.test(fs.readFileSync(f, "utf8")), f); });
function fakeFetch() {
  const db = new Map(), calls = []; let n = 0;
  const f = async (url, { method = "GET", body } = {}) => { const u = new URL(url), p = u.pathname.replace("/api/v1/ai/conversations", ""), b = body ? JSON.parse(body) : null; calls.push(`${method} ${p || "/"}`);
    const ok = j => ({ ok: true, status: 200, json: async () => j });
    if (method === "POST" && p === "") { const c = { id: `r${++n}`, title: b.title, dataset_ref: b.dataset_ref, status: "open", messages: [], created_at: "t", updated_at: "t" }; db.set(c.id, c); return ok(c); }
    if (method === "GET" && p === "") return ok([...db.values()]);
    const m = /^\/([^/]+)(\/(\w+))?$/.exec(p), c = db.get(m?.[1]); if (!c) return { ok: false, status: 404, json: async () => ({ detail: "Conversation not found" }) };
    if (method === "GET") return ok(c); if (m[3] === "messages") { c.messages.push({ id: `m${c.messages.length}`, ...b, at: "t" }); return ok({ n_messages: c.messages.length }); }
    if (m[3] === "close") c.status = "closed"; if (m[3] === "reopen") c.status = "open"; return ok(c); };
  return { f, calls, db };
}
test("BackendConversationStore persists an AI Core conversation through the backend API and restores it", async () => {
  const { f, calls, db } = fakeFetch(), old = globalThis.fetch; globalThis.fetch = f;
  try {
    const client = new BackendClient({ baseUrl: "http://api.test", accessToken: "tok" }), ai = AICore.withMock(); ai.conversations = new ConversationManager(new BackendConversationStore(client));
    const m = new DataSourceManager(), d = m.fromDemo({ nEvents: 500 }); await ai.send("hola", { dataset: d, analysis: runAnalysis(d) });
    assert.equal(db.size, 1); const remote = [...db.values()][0]; assert.deepEqual(remote.messages.map(x => x.role), ["user", "assistant"]); assert.equal(remote.messages[1].meta.isMock, true);
    assert.ok(calls.filter(c => c.startsWith("POST /")).length >= 3, "created once, then appended messages incrementally");
    await ai.conversations.close(); assert.equal(remote.status, "closed");
    const fresh = new ConversationManager(new BackendConversationStore(client)), c = await fresh.resume(remote.id); assert.equal(c.messages.length, 2); assert.equal(remote.status, "open");
    await fresh.add("user", "sigo"); assert.equal(remote.messages.length, 3);
    assert.throws(() => new BackendConversationStore(new BackendClient()), /no configurado/);
  } finally { globalThis.fetch = old; }
});
