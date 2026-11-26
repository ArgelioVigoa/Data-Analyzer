import test from "node:test"; import assert from "node:assert/strict";
import { AICore, AIProvider, assertProvider, ProviderManager, MockProvider, MOCK_BANNER, AISettings, PromptManager, buildContext, processResponse, ConversationManager } from "../src/ai-core/index.js";
import { DataSourceManager } from "../src/data/data-source-manager.js"; import { runAnalysis } from "../src/analysis/neutron-service.js";
const setup = () => { const m = new DataSourceManager(), d = m.fromDemo({ nEvents: 2000 }); return { d, a: runAnalysis(d) }; };
test("Mock provider is explicit about being a test tool and registers through the interface", async () => {
  const p = new MockProvider(); assertProvider(p); assert.equal(p.isMock, true); assert.match(p.label, /pruebas/i);
  const r = await p.generate({ messages: [{ role: "user", content: "hola" }], context: {} }); assert.ok(r.text.startsWith(MOCK_BANNER)); assert.equal(r.isMock, true);
});
test("AI Core end-to-end with the mock: conversation, context, prompt, response", async () => {
  const { d, a } = setup(), ai = AICore.withMock(), out = await ai.send("Quiero estudiar el espectro", { dataset: d, analysis: a });
  assert.equal(out.response.isMock, true); assert.match(out.response.text, /MOCK/); assert.match(out.response.text, /5 indicadores/);
  assert.equal(ai.conversations.current.messages.length, 2); assert.deepEqual(ai.conversations.current.messages.map(m => m.role), ["user", "assistant"]);
  assert.equal(ai.conversations.current.messages[1].meta.isMock, true);
});
test("context sends selected information only: no raw energies, no original filename", () => {
  const { d, a } = setup(), { context, report } = buildContext({ dataset: d, analysis: a, settings: { maxContextChars: 6000 } }), json = JSON.stringify(context);
  assert.ok(!("sample" in context)); assert.ok(!json.includes(String(d.edepMeV.find(v => v > 0)))); assert.ok(report.excluded.includes("valores individuales de energía"));
  assert.equal(context.indicators.length, 5); assert.ok(report.chars === json.length && report.chars <= 6000);
});
test("raw data are included only on explicit opt-in, and bounded to 50 values", () => {
  const { d } = setup(), { context } = buildContext({ dataset: d, settings: { includeRawData: true, maxContextChars: 6000 } }); assert.equal(context.sample.length, 50);
});
test("context size limit is enforced", () => { const { d, a } = setup(); assert.throws(() => buildContext({ dataset: d, analysis: a, settings: { maxContextChars: 100 } }), /supera el límite/); });
test("settings refuse credentials (keys/tokens) and invalid values", () => {
  const s = new AISettings(); for (const bad of [{ apiKey: "x" }, { token: "abc" }, { model: "sk-" + "a".repeat(32) }, { model: "Bearer abcdefghijklmnopqrstuvwxyz" }]) assert.throws(() => s.update(bad), /credenciales/);
  assert.throws(() => s.update({ foo: 1 }), /desconocido/); assert.throws(() => s.update({ temperature: 9 }), /temperature/); assert.equal(s.update({ temperature: 0.5 }).temperature, 0.5);
});
test("provider manager: contract validation, duplicates, switching, empty state", () => {
  const pm = new ProviderManager(); assert.throws(() => pm.active, /ningún proveedor/);
  assert.throws(() => pm.register({ id: "x" }), /no válido/); pm.register(new MockProvider()); assert.throws(() => pm.register(new MockProvider()), /ya registrado/);
  class Fake extends AIProvider { get id() { return "fake"; } get label() { return "Fake"; } async generate() { return { text: "ok", provider: "fake", model: "m", isMock: false }; } }
  pm.register(new Fake()); pm.setActive("fake"); assert.equal(pm.active.id, "fake"); assert.throws(() => pm.setActive("nope"), /no registrado/); assert.equal(pm.list().filter(p => p.active).length, 1);
});
test("a different provider plugs in without changing the core (adapter contract)", async () => {
  class Echo extends AIProvider { get id() { return "echo"; } get label() { return "Echo (test double)"; } get isMock() { return true; } get transport() { return "browser"; } async generate({ messages }) { return { text: `echo:${messages.at(-1).content}`, provider: "echo", model: "e", isMock: true }; } }
  const ai = new AICore(); ai.providers.register(new Echo()); const o = await ai.send("hola"); assert.equal(o.response.text, "echo:hola");
});
test("response processor rejects malformed output and mismatched providers; strips control chars", () => {
  assert.throws(() => processResponse(null), /no válida/); assert.throws(() => processResponse({ text: "a" }), /isMock/); assert.throws(() => processResponse({ text: "a", isMock: false, provider: "x" }, { expectedProvider: "y" }), /distinto/);
  assert.equal(processResponse({ text: "a\u0000b", isMock: true, provider: "m" }).text, "ab"); assert.ok(processResponse({ text: "x".repeat(30000), isMock: true, provider: "m" }).warnings.length);
});
test("conversation manager: limits, close/resume, validation", async () => {
  const c = new ConversationManager(); await assert.rejects(() => c.add("user", "x"), /No hay conversación/); const conv = await c.start({ datasetId: "d1" });
  await c.add("user", "hola"); await assert.rejects(() => c.add("user", "   "), /vacío/); await assert.rejects(() => c.add("bot", "x"), /Rol/); await assert.rejects(() => c.add("user", "x".repeat(9000)), /largo/);
  await c.close(); await assert.rejects(() => c.add("user", "otra"), /cerrada/); const r = await c.resume(conv.id); assert.equal(r.messages.length, 1); await c.add("user", "sigo"); assert.equal(c.current.messages.length, 2);
});
test("prompt manager renders versioned templates and rejects missing variables", () => {
  const p = new PromptManager(); assert.match(p.render("system.scientific-assistant/v0", { language: "es" }), /EXCLUSIVAMENTE el contexto/); assert.throws(() => p.render("system.scientific-assistant/v0", {}), /Falta la variable/); assert.throws(() => p.register("mal-id", "x"), /nombre\/vN/);
});
test("AI Core never ships a real provider in this stage", async () => {
  const fs = await import("node:fs"), path = await import("node:path"), dir = "src/ai-core/providers";
  assert.deepEqual(fs.readdirSync(dir), ["mock-provider.js"]);
  const all = ["src/ai-core", "src/ui"].flatMap(d => fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter(f => f.endsWith(".js")).map(f => path.join(d, f)) : []);
  for (const f of all) assert.ok(!/(generativelanguage\.googleapis|api\.groq\.com|openrouter\.ai|localhost:11434|api\.openai\.com)/.test(fs.readFileSync(f, "utf8")), `${f} must not reference a real AI endpoint`);
});
