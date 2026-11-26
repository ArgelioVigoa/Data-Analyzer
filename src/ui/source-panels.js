/** Data-source panels. The GEANT4 loader and the demo simulator are used by BOTH modes (one implementation each). */
import { el, clear, fmtNum } from "./dom.js";
import { dataSourceManager as dsm } from "../data/data-source-manager.js";
import { ENERGY_UNITS } from "../data/canonical-dataset.js";
import { DEFAULTS, MODEL } from "../simulation/neutron-demo.js";
import { LIMITS } from "../io/geant4-parser.js";

const errBox = () => el("div", { class: "nr-err", role: "alert", "aria-live": "polite" });
const show = (box, e) => { clear(box); if (e) { box.append(el("p", { text: e.message ?? String(e) })); for (const i of (e.issues ?? []).slice(1, 4)) box.append(el("p", { class: "mu", text: i })); } };
const unitSel = (id, value = "MeV") => el("select", { id, "aria-label": "Unidad de energía" }, ...Object.keys(ENERGY_UNITS).map(u => el("option", { value: u, selected: u === value }, u)));

export function mountGeant4Loader(parent, { onLoaded = () => {} } = {}) {
  const box = el("div", { class: "nr-src", "data-testid": "src-geant4" }), err = errBox(), map = el("div"), file = el("input", { type: "file", id: "g4file", accept: ".csv,.txt,.tsv,.dat", "aria-label": "Archivo GEANT4" });
  box.append(el("h4", { text: "Cargar archivo generado por GEANT4" }),
    el("p", { class: "mu", text: `Formato admitido: ntupla CSV del Analysis Manager de Geant4 (cabecera «#column» o «Hippo»), CSV/TSV con fila de encabezado. No se admiten ROOT, HDF5, XML ni histogramas ya agrupados. Máx. ${LIMITS.maxBytes / 1048576} MB.` }), file, err, map); parent.append(box);
  file.addEventListener("change", async () => {
    show(err, null); clear(map); const f = file.files[0]; if (!f) return;
    try {
      if (f.size > LIMITS.maxBytes) throw new Error(`Archivo demasiado grande (${(f.size / 1048576).toFixed(1)} MB; máx. ${LIMITS.maxBytes / 1048576} MB).`);
      const head = new Uint8Array(await f.slice(0, 4).arrayBuffer()); if (head[0] === 0x72 && head[1] === 0x6f && head[2] === 0x6f && head[3] === 0x74) throw new Error("Formato ROOT no admitido. Exporte la ntupla en formato CSV.");
      const { parsed, suggestion } = dsm.inspectGeant4(await f.text(), f.name); renderMapping(parsed, suggestion);
    } catch (e) { show(err, e); }
  });
  function renderMapping(parsed, sg) {
    const num = j => sg.numeric[j], eSel = el("select", { id: "g4energy", "aria-label": "Columna de energía depositada" }, ...parsed.columns.map((c, j) => el("option", { value: j, disabled: !num(j), selected: sg.energy[0] === j }, `${c.name}${c.type ? " (" + c.type + ")" : ""}${num(j) ? "" : " — no numérica"}`)));
    const evSel = el("select", { id: "g4event", "aria-label": "Columna de evento" }, el("option", { value: "" }, "— ninguna: cada fila es un evento (lo confirmo) —"), ...parsed.columns.map((c, j) => el("option", { value: j, selected: sg.event === j }, c.name)));
    const u = unitSel("g4unit", "MeV"), nTot = el("input", { type: "number", id: "g4total", min: 1, step: 1, placeholder: "opcional", "aria-label": "Total de eventos simulados" });
    const prev = el("table", { class: "nr-table" }, el("tr", {}, ...parsed.columns.map(c => el("th", { text: c.name }))), ...parsed.rows.slice(0, 5).map(r => el("tr", {}, ...r.map(v => el("td", { text: v })))));
    map.append(el("p", { class: "mu", text: `Formato detectado: ${parsed.format}${parsed.title ? ` · título «${parsed.title}»` : ""} · ${parsed.rows.length} filas · ${parsed.columns.length} columnas` }), ...parsed.warnings.map(w => el("p", { class: "wn", text: `⚠ ${w}` })),
      el("div", { class: "g2" }, el("div", {}, el("label", { for: "g4energy", text: "Columna de energía depositada" }), eSel, el("label", { for: "g4unit", text: "Unidad en el archivo (GEANT4 CSV no guarda unidades; las internas son MeV)" }), u),
        el("div", {}, el("label", { for: "g4event", text: "Columna de evento (si hay datos por paso, se suman por evento)" }), evSel, el("label", { for: "g4total", text: "Total de eventos simulados N (incluidos los sin depósito)" }), nTot)),
      el("details", {}, el("summary", { text: "Vista previa: así se interpretarán sus datos" }), prev),
      el("button", { id: "g4use", onclick: () => {
        try { const ev = evSel.value === "" ? null : +evSel.value; show(err, null);
          const ds = dsm.fromGeant4(parsed, { energyColumn: +eSel.value, unit: u.value, eventColumn: ev, rowsAreEvents: ev === null, nEventsTotal: nTot.value ? +nTot.value : null }); onLoaded(ds);
        } catch (e) { show(err, e); } } }, "Usar estos datos"));
  }
  return box;
}

export function mountDemoPanel(parent, { onRun = () => {} } = {}) {
  const box = el("div", { class: "nr-src", "data-testid": "src-demo" }), err = errBox(), inputs = {};
  const fields = [["nEvents", "Eventos (neutrones primarios)", 1, 1e6, 1], ["energyMeV", "Energía del neutrón (MeV)", 0.01, 10, "any"], ["sigmaBarn", "σ n–p (barn)", 0.01, 100, "any"], ["thicknessCm", "Espesor de polietileno (cm)", 0.001, 100, "any"], ["densityGcm3", "Densidad (g/cm³)", 0.1, 3, "any"], ["seed", "Semilla", 0, 4294967295, 1]];
  box.append(el("h4", { text: "Simulación demostrativa local" }), el("p", { class: "nr-model", text: MODEL.label }),
    el("details", {}, el("summary", { text: "Hipótesis y límites del modelo" }), el("ul", {}, ...MODEL.assumptions.map(a => el("li", { text: a })), el("li", { text: MODEL.validity }))),
    el("div", { class: "g3" }, ...fields.map(([k, t, mn, mx, st]) => { const i = el("input", { type: "number", id: `demo_${k}`, min: mn, max: mx, step: st, value: DEFAULTS[k] }); inputs[k] = i; return el("div", {}, el("label", { for: `demo_${k}`, text: t }), i); })),
    err, el("button", { id: "demoRun", onclick: () => { try { show(err, null); const p = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, Number(i.value)])); onRun(dsm.fromDemo(p)); } catch (e) { show(err, e); } } }, "Ejecutar simulación demostrativa"),
    el("p", { class: "mu", text: "El σ n–p por defecto es un valor redondeado de orden de magnitud para ~2–3 MeV; es un parámetro editable. Esta demostración ilustra el flujo de datos, no predice resultados cuantitativos." })); parent.append(box); return box;
}

export function mountManualTable(parent) {
  const box = el("div", { class: "nr-src", "data-testid": "src-manual" }), err = errBox(), body = el("tbody"), u = unitSel("manUnit", "MeV"), nTot = el("input", { type: "number", id: "manTotal", min: 1, step: 1, placeholder: "opcional", "aria-label": "Total de eventos simulados" });
  let rows = Array.from({ length: 5 }, () => ({ value: "" })), timer = null;
  const apply = () => { try { show(err, null); if (!rows.some(r => String(r.value).trim() !== "")) { return; } dsm.fromManualRows(rows, { unit: u.value, nEventsTotal: nTot.value ? +nTot.value : null }); } catch (e) { show(err, e); } };
  const later = () => { clearTimeout(timer); timer = setTimeout(apply, 300); };
  const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  function paint() {
    clear(body); rows.forEach((r, i) => { const bad = String(r.value).trim() !== "" && (!NUM.test(String(r.value).trim()) || Number(r.value) < 0);
      const inp = el("input", { type: "text", inputmode: "decimal", value: r.value, "aria-label": `Energía del evento ${i + 1}`, class: bad ? "bad" : "", oninput: e => { r.value = e.target.value; e.target.classList.toggle("bad", e.target.value.trim() !== "" && (!NUM.test(e.target.value.trim()) || Number(e.target.value) < 0)); later(); },
        onpaste: e => { const t = e.clipboardData?.getData("text") ?? ""; if (/[\r\n]/.test(t.trim())) { e.preventDefault(); const vals = t.trim().split(/\r?\n/).map(s => s.split("\t")[0].trim()); rows.splice(i, 1, ...vals.map(v => ({ value: v }))); paint(); later(); } } });
      body.append(el("tr", {}, el("td", { class: "num mu", text: i + 1 }), el("td", {}, inp), el("td", {}, el("button", { class: "g", "aria-label": `Eliminar fila ${i + 1}`, onclick: () => { rows.splice(i, 1); if (!rows.length) rows.push({ value: "" }); paint(); later(); } }, "✕")))); });
  }
  box.append(el("h4", { text: "Introducir datos manualmente" }), el("p", { class: "mu", text: "Una fila = un evento (un neutrón primario). Use 0 para eventos sin energía depositada. Punto decimal. Puede pegar una columna desde una hoja de cálculo." }),
    el("div", { class: "g2" }, el("div", {}, el("label", { for: "manUnit", text: "Unidad de la columna E_dep" }), u), el("div", {}, el("label", { for: "manTotal", text: "Total de eventos simulados N (opcional)" }), nTot)),
    el("table", { class: "nr-table nr-edit" }, el("thead", {}, el("tr", {}, el("th", { text: "#" }), el("th", { text: "E_dep" }), el("th", { text: "" }))), body),
    el("div", { class: "nr-btns" }, el("button", { class: "g", id: "manAdd", onclick: () => { rows.push({ value: "" }); paint(); } }, "+ Fila"), el("button", { class: "g", id: "manAdd10", onclick: () => { for (let k = 0; k < 10; k++) rows.push({ value: "" }); paint(); } }, "+ 10 filas"), el("button", { id: "manApply", onclick: apply }, "Validar y graficar")), err);
  u.addEventListener("change", later); nTot.addEventListener("input", later); paint(); parent.append(box); return box;
}
