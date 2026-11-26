/**
 * GEANT4 output reader (text outputs of the Geant4 analysis manager, "csv" type).
 *
 * Verified against the g4tools source (tools/wcsv_ntuple): a commented header contains
 *   #class tools::wcsv::ntuple / #title <t> / #separator <ASCII code> / #vector_separator <ASCII code>
 *   #column <type> <name>   (one per column; types such as double, float, int, int64, string…)
 * followed by one row per ntuple entry. The "Hippo" header variant is the title line followed by a TAB-separated
 * list of column names. Geant4 CSV files DO NOT carry units: values are in Geant4 internal units
 * (energy: MeV) unless the user code divided them by a unit before filling. The user therefore declares the unit.
 *
 * Not supported (clear error, no guessing): ROOT/HDF5/XML binary files, pre-binned histogram CSVs (#class tools::histo::*),
 * step-level files without an event identifier unless the user accepts "one row = one event".
 */
import { ENERGY_UNITS } from "../data/canonical-dataset.js";

export class Geant4FormatError extends Error { constructor(m, issues = []) { super(m); this.name = "Geant4FormatError"; this.issues = issues; } }
export const LIMITS = Object.freeze({ maxBytes: 50 * 1024 * 1024, maxRows: 2_000_000, maxColumns: 64 });
const ENERGY_NAMES = ["edep", "energydeposit", "energydeposited", "energy_deposit", "depositedenergy", "e_dep", "edeposit", "totaledep", "eventedep", "edepevent", "energia", "energy", "e"];
const EVENT_NAMES = ["eventid", "event", "evtid", "evt", "eventnumber", "event_id", "id_evento"];
const norm = s => String(s).toLowerCase().replace(/[\s\-.\(\)\[\]]/g, "");
const isNum = s => s !== "" && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s.trim());

function sniff(text) {
  const head = text.slice(0, 8);
  if (head.startsWith("root") || head.startsWith("\u0089HDF") || text.slice(0, 4) === "\u0000\u0000\u0000") throw new Geant4FormatError("Formato binario no admitido (ROOT/HDF5). Exporte con el Analysis Manager en formato CSV (G4AnalysisManager con extensión .csv).");
  if (/^\s*<\?xml/.test(text) || /^\s*<aida/i.test(text)) throw new Geant4FormatError("Formato XML (AIDA) no admitido. Exporte la ntupla en formato CSV.");
  if (/^#class\s+tools::histo::/m.test(text)) throw new Geant4FormatError("Este archivo es un histograma ya agrupado (tools::histo). Se necesita la ntupla con una fila por evento.");
}

/** @returns {{format:string,title:string|null,columns:{name:string,type:string|null,vector:boolean}[],rows:string[][],separator:string,warnings:string[]}} */
export function parseGeant4(text, { filename = "" } = {}) {
  if (typeof text !== "string") throw new Geant4FormatError("El contenido del archivo no es texto.");
  if (text.length > LIMITS.maxBytes) throw new Geant4FormatError(`Archivo demasiado grande (máx. ${LIMITS.maxBytes / 1048576} MB).`);
  text = text.replace(/^\uFEFF/, "");
  sniff(text);
  const lines = text.split(/\r\n|\n|\r/), warnings = [];
  let sep = null, vsep = ";", title = null, format = null, i = 0; const cols = [];
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && lines[i].startsWith("#")) {                       // commented header (g4tools)
    format = "geant4-csv-commented-header";
    for (; i < lines.length && (lines[i].startsWith("#") || lines[i].trim() === ""); i++) {
      const l = lines[i].trim(); let m;
      if ((m = /^#class\s+(\S+)/.exec(l)) && !/ntuple/.test(m[1])) throw new Geant4FormatError(`Clase de archivo no admitida: ${m[1]}. Se esperaba una ntupla (tools::wcsv::ntuple).`);
      else if ((m = /^#title\s*(.*)$/.exec(l))) title = m[1] || null;
      else if ((m = /^#separator\s+(\d+)/.exec(l))) sep = String.fromCharCode(+m[1]);
      else if ((m = /^#vector_separator\s+(\d+)/.exec(l))) vsep = String.fromCharCode(+m[1]);
      else if ((m = /^#column\s+(vector<\s*)?([\w:<>\s]+?)\s+(\S+)\s*$/.exec(l))) cols.push({ name: m[3], type: m[2].replace(/\s/g, "") , vector: /vector|std::vector/.test(l) });
    }
    if (!cols.length) throw new Geant4FormatError("Cabecera comentada sin líneas «#column»: no se pueden identificar las columnas.");
    sep = sep ?? ",";
  } else {
    const first = lines[i] ?? "", second = lines[i + 1] ?? "";
    const guess = s => (s.includes("\t") ? "\t" : s.includes(";") ? ";" : s.includes(",") ? "," : null);
    if (first && !first.includes("\t") && !first.includes(",") && !first.includes(";") && second.includes("\t") && !second.split("\t").every(isNum)) {   // Hippo: title + names
      format = "geant4-csv-hippo-header"; title = first.trim(); i++; sep = "\t";
      lines[i].split("\t").forEach(n => cols.push({ name: n.trim(), type: null, vector: false })); i++;
    } else {
      sep = guess(first) ?? ",";
      const cells = first.split(sep).map(s => s.trim());
      if (cells.length && !cells.every(isNum)) { format = "csv-with-header-row"; cells.forEach(n => cols.push({ name: n || `columna_${cols.length + 1}`, type: null, vector: false })); i++; }
      else { format = "csv-headerless"; cells.forEach((_, j) => cols.push({ name: `columna_${j + 1}`, type: null, vector: false })); warnings.push("El archivo no tiene cabecera: las columnas se han llamado columna_1, columna_2…"); }
    }
  }
  if (cols.length > LIMITS.maxColumns) throw new Geant4FormatError(`Demasiadas columnas (${cols.length}).`);
  const rows = []; let skipped = 0;
  for (; i < lines.length; i++) {
    const l = lines[i]; if (l.trim() === "" || l.startsWith("#")) continue;
    const r = l.split(sep);
    if (r.length !== cols.length) { skipped++; if (skipped <= 3) warnings.push(`Línea ${i + 1}: ${r.length} campos, se esperaban ${cols.length}; fila omitida.`); continue; }
    rows.push(r);
    if (rows.length > LIMITS.maxRows) throw new Geant4FormatError(`Demasiadas filas (máx. ${LIMITS.maxRows}).`);
  }
  if (skipped > 3) warnings.push(`${skipped} filas omitidas por número de campos incorrecto.`);
  if (!rows.length) throw new Geant4FormatError("El archivo no contiene filas de datos.");
  cols.forEach((c, j) => { if (rows.some(r => r[j].includes(vsep) && vsep !== sep && !isNum(r[j]))) c.vector = true; });
  return { format, title, filename, columns: cols, rows, separator: sep, warnings };
}

/** Suggests which columns are the energy deposit and the event id (the user can override). */
export function suggestColumns(parsed) {
  const idx = names => parsed.columns.map((c, j) => [norm(c.name), j]).filter(([n]) => names.includes(n)).map(([, j]) => j);
  const energy = idx(ENERGY_NAMES).filter(j => !parsed.columns[j].vector && parsed.rows.every(r => isNum(r[j])));
  const event = idx(EVENT_NAMES);
  return { energy, event: event[0] ?? null, numeric: parsed.columns.map((c, j) => !c.vector && parsed.rows.every(r => isNum(r[j]))) };
}

/**
 * Converts the chosen column into MeV per event.
 * @param {{energyColumn:number, unit:keyof typeof ENERGY_UNITS, eventColumn?:number|null, rowsAreEvents?:boolean}} o
 *  - eventColumn set and repeated ids  => step/hit-level data: energies are SUMMED per event (reported in `aggregated`).
 *  - no eventColumn => `rowsAreEvents` must be true (explicit user acceptance).
 */
export function extractEnergies(parsed, { energyColumn, unit, eventColumn = null, rowsAreEvents = false }) {
  const issues = [], col = parsed.columns[energyColumn];
  if (!col) throw new Geant4FormatError("Seleccione la columna de energía depositada.");
  if (col.vector) throw new Geant4FormatError(`La columna «${col.name}» es vectorial: no se puede usar como energía por evento.`);
  const f = ENERGY_UNITS[unit];
  if (!f) throw new Geant4FormatError(`Unidad de energía no válida: ${unit}. Admitidas: ${Object.keys(ENERGY_UNITS).join(", ")}.`);
  const raw = [];
  for (let r = 0; r < parsed.rows.length; r++) {
    const s = parsed.rows[r][energyColumn].trim();
    if (!isNum(s)) { issues.push(`Fila de datos ${r + 1}: «${s.slice(0, 20)}» no es un número (columna «${col.name}»).`); if (issues.length >= 5) break; continue; }
    raw.push(Number(s) * f);
  }
  if (issues.length) throw new Geant4FormatError(issues[0], issues);
  const neg = raw.findIndex(v => v < 0);
  if (neg >= 0) throw new Geant4FormatError(`Energía negativa en la fila de datos ${neg + 1}: una energía depositada no puede ser negativa.`);
  let edepMeV = raw, aggregated = false, eventsSeen = raw.length;
  if (eventColumn !== null && eventColumn !== undefined) {
    if (!parsed.columns[eventColumn]) throw new Geant4FormatError("Columna de evento no válida.");
    const by = new Map();
    parsed.rows.forEach((row, r) => { const k = row[eventColumn].trim(); by.set(k, (by.get(k) ?? 0) + raw[r]); });
    aggregated = by.size < raw.length; eventsSeen = by.size; edepMeV = [...by.values()];
  } else if (!rowsAreEvents) {
    throw new Geant4FormatError("Sin columna de evento no puedo saber si cada fila es un evento o un paso de simulación. Elija una columna de evento o confirme que «cada fila es un evento».");
  }
  return { edepMeV, aggregated, eventsSeen, unit, rowsRead: raw.length };
}
