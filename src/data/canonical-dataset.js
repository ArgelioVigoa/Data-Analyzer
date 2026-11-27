/**
 * Canonical dataset for the neutron energy-deposition use case (graph 6).
 * Every data source (GEANT4 file, demo simulation, manual table) is converted to this single shape,
 * so one engine serves both the manual and the AI-assisted modes.
 *
 * Physical meaning: `edepMeV[i]` is the energy deposited in the sensitive volume in event i
 * (one primary neutron history), in MeV. Zero is a legitimate value (the neutron did not deposit energy).
 */
export const SCHEMA = "data-analyzer.neutron-edep/1";
export const SOURCE_TYPES = Object.freeze(["geant4-file", "demo-simulation", "manual-table"]);
/** Multiplicative factor converting each unit to MeV. */
export const ENERGY_UNITS = Object.freeze({ eV: 1e-6, keV: 1e-3, MeV: 1, GeV: 1e3, J: 1 / 1.602176634e-13 });
export const LIMITS = Object.freeze({ maxEvents: 2_000_000 });

export class DatasetError extends Error {
  constructor(message, issues = []) { super(message); this.name = "DatasetError"; this.issues = issues; }
}

/** Validates energies already expressed in MeV. Returns {errors, warnings}; never mutates input. */
export function validateEnergies(values, { nEventsTotal = null } = {}) {
  const errors = [], warnings = [];
  if (!Array.isArray(values) && !ArrayBuffer.isView(values)) return { errors: ["Los datos de energía deben ser una lista de números."], warnings };
  if (values.length === 0) errors.push("No hay eventos: se necesita al menos uno.");
  if (values.length > LIMITS.maxEvents) errors.push(`Demasiados eventos (${values.length}); máximo ${LIMITS.maxEvents}.`);
  let bad = -1, neg = -1, nBad = 0, nNeg = 0, nZero = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) { nBad++; if (bad < 0) bad = i; }
    else if (v < 0) { nNeg++; if (neg < 0) neg = i; }
    else if (v === 0) nZero++;
  }
  if (nBad) errors.push(`${nBad} valor(es) no numérico(s) o no finito(s) (primero: evento ${bad + 1}).`);
  if (nNeg) errors.push(`${nNeg} valor(es) negativo(s) (primero: evento ${neg + 1}): una energía depositada no puede ser negativa.`);
  if (nEventsTotal !== null) {
    if (!Number.isInteger(nEventsTotal) || nEventsTotal < 1) errors.push("El número total de eventos simulados debe ser un entero ≥ 1.");
    else if (nEventsTotal < values.length) errors.push(`El total de eventos simulados (${nEventsTotal}) no puede ser menor que las filas registradas (${values.length}).`);
    else if (nEventsTotal > LIMITS.maxEvents * 50) errors.push("El total de eventos simulados es excesivo.");
  }
  if (!errors.length && nZero === values.length && nEventsTotal === null) warnings.push("Todos los eventos tienen energía depositada nula: no habrá espectro que representar.");
  return { errors, warnings };
}

/**
 * @param {object} p
 * @param {"geant4-file"|"demo-simulation"|"manual-table"} p.sourceType
 * @param {string} p.name
 * @param {number[]} p.edepMeV      energy per recorded event, MeV
 * @param {number|null} p.nEventsTotal  total simulated primaries (>= rows). null = every event is a recorded row.
 * @param {object} p.provenance     how the data were obtained (file, parser, model, parameters…)
 */
export function createCanonicalDataset({ sourceType, name, edepMeV, nEventsTotal = null, provenance = {} }) {
  if (!SOURCE_TYPES.includes(sourceType)) throw new DatasetError(`Tipo de fuente desconocido: ${sourceType}`);
  const { errors, warnings } = validateEnergies(edepMeV, { nEventsTotal });
  if (errors.length) throw new DatasetError(errors[0], errors);
  const id = (globalThis.crypto?.randomUUID?.() ?? `ds-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return Object.freeze({
    schema: SCHEMA, id, name: String(name || "Conjunto sin nombre").slice(0, 200), sourceType,
    createdAt: new Date().toISOString(),
    quantity: Object.freeze({ id: "energy_deposited_per_event", symbol: "E_dep", unit: "MeV" }),
    edepMeV: Array.from(edepMeV),
    nRecorded: edepMeV.length,
    nEvents: nEventsTotal ?? edepMeV.length,
    nEventsAssumed: nEventsTotal === null,   // true => N was assumed equal to the number of rows
    provenance: Object.freeze({ ...provenance }),
    warnings: Object.freeze([...warnings])
  });
}

/** Compact, JSON-safe description of a dataset WITHOUT the raw values (for persistence and AI context). */
export function describeDataset(ds) {
  return {
    schema: ds.schema, id: ds.id, name: ds.name, sourceType: ds.sourceType, createdAt: ds.createdAt,
    quantity: ds.quantity, nRecorded: ds.nRecorded, nEvents: ds.nEvents, nEventsAssumed: ds.nEventsAssumed,
    provenance: ds.provenance, warnings: [...ds.warnings]
  };
}
