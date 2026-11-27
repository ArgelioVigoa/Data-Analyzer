/** Result panel SHARED by manual and AI modes: same engine (runAnalysis), same figure, same indicators table. */
import { el, clear, fmtNum } from "./dom.js";
import { runAnalysis } from "../analysis/neutron-service.js";
import { dataSourceManager } from "../data/data-source-manager.js";

const SRC_LABEL = { "geant4-file": "Archivo GEANT4 (cargado por el usuario)", "demo-simulation": "Simulación demostrativa propia — NO es GEANT4", "manual-table": "Datos introducidos manualmente" };
export const state = { showStats: true, bins: "auto", scale: "auto", last: null };

export function mountResultPanel(parent, { onAnalysis = () => {} } = {}) {
  const root = el("div", { class: "nr-panel", "data-testid": "result-panel" }), info = el("div", { class: "nr-info" }), ctl = el("div", { class: "nr-ctl" }), plotBox = el("div", { class: "nr-plot", id: "nrPlot" }), notes = el("div", { class: "nr-notes" }), table = el("div", { class: "nr-stats" });
  const tg = el("input", { type: "checkbox", id: "nrToggleStats", checked: state.showStats, onchange: e => { state.showStats = e.target.checked; draw(); } });
  const bins = el("input", { type: "number", min: 5, max: 500, placeholder: "auto", class: "nr-bins", "aria-label": "Número de intervalos", value: state.bins === "auto" ? "" : state.bins, onchange: e => { state.bins = e.target.value ? Math.max(5, Math.min(500, Math.floor(+e.target.value))) : "auto"; draw(); } });
  const scale = el("select", { "aria-label": "Escala de intervalos", onchange: e => { state.scale = e.target.value; draw(); } }, ...[["auto", "Escala: automática"], ["linear", "Escala: lineal"], ["log", "Escala: logarítmica"]].map(([v, t]) => el("option", { value: v, selected: v === state.scale }, t)));
  ctl.append(el("label", { class: "nr-switch", for: "nrToggleStats" }, tg, el("span", { class: "nr-slider" }), el("span", { text: "Mostrar indicadores estadísticos" })), el("label", { class: "nr-inline" }, "Intervalos ", bins), scale);
  root.append(info, ctl, plotBox, notes, table); parent.append(root);

  async function draw() {
    const ds = dataSourceManager.get(); clear(info); clear(notes); clear(table);
    if (!ds) { info.append(el("p", { class: "mu", text: "Aún no hay datos: cargue un archivo, ejecute la simulación demostrativa o introduzca datos en la tabla." })); clear(plotBox); ctl.style.display = "none"; return; }
    ctl.style.display = "";
    let out; try { out = runAnalysis(ds, { bins: state.bins, scale: state.scale, showStats: state.showStats }); } catch (e) { info.append(el("p", { class: "nr-err", role: "alert", text: e.message })); return; }
    state.last = out; onAnalysis(out, ds);
    info.append(el("p", {}, el("b", { text: ds.name }), " ", el("span", { class: `tag nr-src-${ds.sourceType}`, text: SRC_LABEL[ds.sourceType] })),
      el("p", { class: "mu", text: `${ds.nEvents} eventos simulados/registrados · ${out.result.nPositive} con energía depositada · unidad interna: MeV · motor ${out.engine}` }));
    for (const w of [...ds.warnings, ...out.result.notes]) notes.append(el("p", { class: "wn", text: `⚠ ${w}` }));
    if (state.showStats) {
      table.append(el("table", { class: "nr-table" }, el("tr", {}, ...["Indicador", "Valor", "Incertidumbre / IC 95 %", "Definición"].map(t => el("th", { text: t }))),
        ...out.result.indicators.map(i => el("tr", { "data-indicator": i.id }, el("td", { text: i.label }), el("td", { class: "num", text: `${fmtNum(i.value)}${i.unit ? " " + i.unit : ""}` }),
          el("td", { class: "num", text: i.ci95 ? `[${fmtNum(i.ci95[0])}, ${fmtNum(i.ci95[1])}]` : i.uncertainty != null ? `± ${fmtNum(i.uncertainty)} ${i.unit}` : "—" }), el("td", { class: "mu", text: i.definition })))),
        el("p", { class: "mu", text: "Cuantiles: interpolación lineal tipo 7. Los indicadores 3–5 se calculan solo sobre eventos con E_dep>0; f y E_media usan todos los eventos simulados." }));
    }
    const ok = await (globalThis.loadPlotly?.() ?? Promise.resolve(false));
    if (!ok || !globalThis.Plotly) { clear(plotBox); plotBox.append(el("p", { class: "wn", text: "No se pudo cargar Plotly (requiere conexión al CDN). Los cálculos y la tabla siguen disponibles." })); return; }
    await globalThis.Plotly.react(plotBox, out.figure.data, out.figure.layout, out.figure.config);
  }
  const unsub = dataSourceManager.subscribe(() => draw());
  draw();
  return { draw, destroy() { unsub(); root.remove(); } };
}
