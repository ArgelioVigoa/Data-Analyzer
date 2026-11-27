/** "Seleccionar archivo para analizar": entry (two distinct flows), manual workspace, and the AI-assisted section (structure only). */
import { el, clear } from "./dom.js";
import { CHART_CATALOG, isAvailable } from "../analysis/chart-catalog.js";
import { dataSourceManager as dsm } from "../data/data-source-manager.js";
import { mountResultPanel, state as rstate } from "./result-panel.js";
import { mountGeant4Loader, mountDemoPanel, mountManualTable } from "./source-panels.js";
import { AICore } from "../ai-core/index.js";
import { MOCK_BANNER } from "../ai-core/providers/mock-provider.js";

const ui = { view: "entry", chart: null, source: "geant4", panel: null, ai: AICore.withMock() };
let root = null;

const back = (to, label) => el("button", { class: "g nr-back", onclick: () => { ui.view = to; ui.panel?.destroy?.(); ui.panel = null; render(); } }, `← ${label}`);

function viewEntry() {
  return el("div", { class: "nr-entry" },
    el("p", { class: "mu", text: "Elija cómo quiere trabajar. Ambos flujos usan los mismos datos, el mismo motor de gráficos y las mismas estadísticas." }),
    el("div", { class: "nr-modes" },
      el("button", { class: "mode-card manual", id: "modeManual", onclick: () => { ui.view = "manual"; render(); } }, el("span", { class: "mc-ic", "aria-hidden": "true", text: "📈" }), el("h3", { text: "Analizar Manualmente" }), el("p", { text: "Elija un gráfico del catálogo, aporte sus datos (archivo GEANT4, simulación demostrativa o tabla editable) y configure los indicadores estadísticos." }), el("span", { class: "bd b1", text: "Disponible · no requiere IA ni cuenta" })),
      el("button", { class: "mode-card ai", id: "modeAI", onclick: () => { ui.view = "ai"; render(); } }, el("span", { class: "mc-ic", "aria-hidden": "true", text: "🧠" }), el("h3", { text: "Analizar con asistencia de IA" }), el("p", { text: "Sección del futuro agente científico: carga de archivo, contexto científico y conversaciones. La entrevista y el proveedor de IA aún no están implementados." }), el("span", { class: "bd b2", text: "Estructura preparada · IA no conectada" }))));
}

function viewManual() {
  const wrap = el("div", { class: "nr-manual" }, back("entry", "Modos de análisis"),
    el("h3", { text: "Catálogo de gráficos" }),
    el("p", { class: "mu", text: "Seleccione un tipo de gráfico. Su espacio de trabajo se abrirá en una vista independiente para mantener la página despejada." }),
    el("div", { class: "nr-catalog", role: "list" }, ...CHART_CATALOG.map(c => {
      const ok = isAvailable(c.id);
      return el("button", { role: "listitem", class: `chart-card${ok ? "" : " locked"}`, "data-chart": c.id, disabled: !ok, "aria-disabled": String(!ok), title: ok ? "Abrir espacio de trabajo" : "Bloqueado: se habilitará en una etapa posterior", onclick: ok ? () => { ui.chart = c.id; ui.view = "workspace"; render(); } : undefined },
        el("span", { class: "cc-n", text: c.n }), el("span", { class: "cc-t", text: c.title }), el("span", { class: ok ? "bd b1" : "bd b3", text: ok ? "Disponible · abrir" : "🔒 Bloqueado" }));
    })));
  return wrap;
}

function viewWorkspace() {
  const chart = CHART_CATALOG.find(c => c.id === ui.chart);
  const wrap = el("div", { class: "nr-workspace" },
    back("manual", "Catálogo de gráficos"),
    el("div", { class: "nr-workspace-heading" },
      el("div", {},
        el("p", { class: "mu nr-kicker", text: "ESPACIO DE TRABAJO · ANÁLISIS MANUAL" }),
        el("h3", { text: chart?.title || "Análisis del gráfico" }),
        el("p", { class: "mu", text: "Configure la fuente de datos y ejecute el análisis en este espacio independiente." }))));
  if (ui.chart !== "neutron-edep" || !chart) {
    wrap.append(el("p", { class: "mu", text: "Este gráfico todavía no está disponible." }));
    return wrap;
  }
  const tabs = el("div", { class: "tabs", role: "tablist" }, ...[["geant4", "A · Archivo GEANT4"], ["demo", "B · Simulación demostrativa"], ["manual", "C · Tabla manual"]].map(([k, t]) => el("button", { role: "tab", class: ui.source === k ? "on" : "", "aria-selected": String(ui.source === k), "data-source": k, onclick: () => { ui.source = k; render(); } }, t)));
  const src = el("div", { class: "nr-workspace-source" });
  wrap.append(tabs, src);
  if (ui.source === "geant4") mountGeant4Loader(src); else if (ui.source === "demo") mountDemoPanel(src); else mountManualTable(src);
  ui.panel = mountResultPanel(wrap);
  return wrap;
}

function viewAI() {
  const ai = ui.ai, wrap = el("div", { class: "nr-ai" }, back("entry", "Modos de análisis"));
  wrap.append(el("div", { class: "nr-banner", role: "note" }, el("b", { text: "Estructura del agente científico — IA NO conectada. " }), "Aquí se prepara la gestión de archivos, el contexto científico y las conversaciones. El «proveedor» disponible es un Mock de pruebas que devuelve texto con plantilla fija: no es una IA y no interpreta sus datos."));
  const src = el("div", { class: "g2" }); mountGeant4Loader(src); mountDemoPanel(src); wrap.append(el("h3", { text: "1 · Datos de entrada" }), src);
  const ctxBox = el("div", { class: "nr-ctx" }), chat = el("div", { class: "nr-chat" }), log = el("div", { class: "nr-log", "aria-live": "polite" }), ta = el("textarea", { id: "aiInput", rows: 2, maxlength: 8000, placeholder: "Escriba un mensaje de prueba…", "aria-label": "Mensaje" }), perr = el("div", { class: "nr-err", role: "alert" });
  const paintCtx = () => { clear(ctxBox); const ds = dsm.get(); if (!ds) { ctxBox.append(el("p", { class: "mu", text: "Sin datos: cargue un archivo GEANT4 o ejecute la simulación demostrativa." })); return; }
    const a = rstate.last; const { context, report } = ai.previewContext({ dataset: ds, analysis: a, objective: "" });
    ctxBox.append(el("p", { class: "mu", text: `Contexto que un futuro proveedor recibiría (${report.chars} de ${ai.settings.value.maxContextChars} caracteres). Valores individuales: NO incluidos.` }), el("p", { text: `Incluye: ${report.included.join(", ")}` }), el("p", { class: "mu", text: `Excluye: ${report.excluded.join(", ")}` }), el("details", {}, el("summary", { text: "Ver contexto (JSON)" }), el("pre", { text: JSON.stringify(context, null, 2) }))); };
  const paintLog = () => { clear(log); for (const m of ai.conversations.current?.messages ?? []) log.append(el("div", { class: `nr-msg ${m.role}` }, el("small", { text: m.role === "user" ? "Usted" : (m.meta?.isMock ? "Proveedor de pruebas (Mock)" : "Asistente") }), el("div", { text: m.content }))); log.scrollTop = log.scrollHeight; };
  const send = el("button", { id: "aiSend", onclick: async () => { const t = ta.value.trim(); if (!t) return; clear(perr); send.disabled = true; try { await ai.send(t, { dataset: dsm.get(), analysis: rstate.last }); ta.value = ""; paintLog(); } catch (e) { perr.append(el("p", { text: e.message })); } finally { send.disabled = false; } } }, "Enviar al proveedor de pruebas");
  const close = el("button", { class: "g", id: "aiClose", onclick: async () => { await ai.conversations.close(); paintLog(); perr.textContent = "Conversación cerrada; puede reabrirla desde la lista."; paintList(); } }, "Cerrar conversación");
  const listSel = el("select", { id: "aiList", "aria-label": "Conversaciones guardadas", onchange: async e => { if (e.target.value) { await ai.conversations.resume(e.target.value); clear(perr); paintLog(); } } });
  const paintList = async () => { clear(listSel); listSel.append(el("option", { value: "" }, "Conversaciones guardadas…")); for (const c of await ai.conversations.store.list()) listSel.append(el("option", { value: c.id }, `${c.title} · ${c.status === "open" ? "abierta" : "cerrada"} · ${new Date(c.updatedAt).toLocaleTimeString()}`)); };
  chat.append(el("p", { class: "nr-mockline", text: `Proveedor activo: ${ai.providers.active.label} ${ai.providers.active.isMock ? "· " + MOCK_BANNER : ""}` }), log, ta, el("div", { class: "nr-btns" }, send, close, listSel), perr,
    el("p", { class: "mu", text: "La entrevista científica, la recomendación de análisis clásicos/cuánticos y la bibliografía se implementarán cuando se conecte un proveedor real." }));
  wrap.append(el("h3", { text: "2 · Resultados (mismo motor que el análisis manual)" })); ui.panel = mountResultPanel(wrap, { onAnalysis: paintCtx });
  wrap.append(el("h3", { text: "3 · Contexto científico preparado" }), ctxBox, el("h3", { text: "4 · Conversación (solo prueba de arquitectura)" }), chat); paintCtx(); paintLog(); paintList(); return wrap;
}

function render() { if (!root) return; ui.panel?.destroy?.(); ui.panel = null; clear(root); root.append(ui.view === "manual" ? viewManual() : ui.view === "workspace" ? viewWorkspace() : ui.view === "ai" ? viewAI() : viewEntry()); }
export const DataAnalyzerUI = { show() { root = document.getElementById("analysisRoot"); ui.view = "entry"; render(); }, _state: ui };
