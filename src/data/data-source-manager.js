/**
 * Data Source Manager — the single entry point that turns the three kinds of input into the canonical dataset
 * and keeps provenance. Both analysis modes call it; none of them parses data on its own.
 */
import { createCanonicalDataset, describeDataset, ENERGY_UNITS, DatasetError } from "./canonical-dataset.js";
import { parseGeant4, extractEnergies, suggestColumns } from "../io/geant4-parser.js";
import { runNeutronDemo, MODEL } from "../simulation/neutron-demo.js";

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export class DataSourceManager {
  #datasets = new Map(); #listeners = new Set(); #activeId = null;
  subscribe(fn) { this.#listeners.add(fn); return () => this.#listeners.delete(fn); }
  #emit() { for (const fn of this.#listeners) fn(this.#activeId); }
  #store(ds) { this.#datasets.set(ds.id, ds); this.#activeId = ds.id; this.#emit(); return ds; }
  get activeId() { return this.#activeId; }
  get(id = this.#activeId) { return this.#datasets.get(id) ?? null; }
  list() { return [...this.#datasets.values()].map(describeDataset); }
  remove(id) { this.#datasets.delete(id); if (this.#activeId === id) this.#activeId = [...this.#datasets.keys()].pop() ?? null; this.#emit(); }
  clear() { this.#datasets.clear(); this.#activeId = null; this.#emit(); }

  /** Step 1 for GEANT4 files: parse and propose a column mapping (nothing is committed yet). */
  inspectGeant4(text, filename = "") { const parsed = parseGeant4(text, { filename }); return { parsed, suggestion: suggestColumns(parsed) }; }

  /** Step 2: commit the mapping chosen by the user (or accepted from the suggestion). */
  fromGeant4(parsed, { energyColumn, unit, eventColumn = null, rowsAreEvents = false, nEventsTotal = null }) {
    const r = extractEnergies(parsed, { energyColumn, unit, eventColumn, rowsAreEvents });
    return this.#store(createCanonicalDataset({
      sourceType: "geant4-file", name: parsed.filename || "Archivo GEANT4", edepMeV: r.edepMeV, nEventsTotal,
      provenance: {
        origin: "Archivo cargado por el usuario (no verificado como salida de GEANT4)", originalFilename: parsed.filename || null, importedAt: new Date().toISOString(),
        parserFormat: parsed.format, title: parsed.title, energyColumn: parsed.columns[energyColumn].name, eventColumn: eventColumn === null ? null : parsed.columns[eventColumn].name,
        declaredUnit: unit, convertedTo: "MeV", rowsRead: r.rowsRead, aggregatedPerEvent: r.aggregated, parserWarnings: parsed.warnings
      }
    }));
  }

  /** Demonstration simulation (shared by manual and AI modes — one simulator). */
  fromDemo(params = {}) {
    const sim = runNeutronDemo(params);
    const ds = createCanonicalDataset({
      sourceType: "demo-simulation", name: "Simulación demostrativa (modelo propio, no GEANT4)", edepMeV: sim.edepMeV, nEventsTotal: sim.nEvents,
      provenance: { origin: MODEL.label, modelId: MODEL.id, generatedAt: new Date().toISOString(), parameters: sim.parameters, assumptions: MODEL.assumptions, expected: sim.expected, modelWarnings: sim.warnings }
    });
    return this.#store(ds);
  }

  /** Manual table: rows are [{value:string|number}] in the declared unit; empty rows are ignored. */
  fromManualRows(rows, { unit = "MeV", nEventsTotal = null, name = "Datos introducidos manualmente" } = {}) {
    const f = ENERGY_UNITS[unit]; if (!f) throw new DatasetError(`Unidad no válida: ${unit}`);
    const issues = [], vals = [];
    rows.forEach((r, i) => {
      const s = String(r?.value ?? "").trim(); if (s === "") return;
      if (!NUM.test(s)) { issues.push(`Fila ${i + 1}: «${s.slice(0, 20)}» no es un número${/^\d+,\d+$/.test(s) ? " (use punto decimal)" : ""}.`); return; }
      vals.push(Number(s) * f);
    });
    if (issues.length) throw new DatasetError(issues[0], issues);
    return this.#store(createCanonicalDataset({ sourceType: "manual-table", name, edepMeV: vals, nEventsTotal, provenance: { origin: "Introducción manual del usuario", enteredAt: new Date().toISOString(), declaredUnit: unit, convertedTo: "MeV", rows: vals.length } }));
  }
}
export const dataSourceManager = new DataSourceManager();
