import test from "node:test"; import assert from "node:assert/strict";
import { parseGeant4, suggestColumns, extractEnergies, Geant4FormatError } from "../src/io/geant4-parser.js";
const HDR = "#class tools::wcsv::ntuple\n#title Neutron hits\n#separator 44\n#vector_separator 59\n#column int EventID\n#column double Edep\n#column string Volume\n";
test("commented g4tools header: columns, types, separator and suggestion", () => {
  const p = parseGeant4(HDR + "0,1.5,Si\n1,0.25,Si\n2,3,Si\n", { filename: "run.csv" });
  assert.equal(p.format, "geant4-csv-commented-header"); assert.equal(p.title, "Neutron hits"); assert.deepEqual(p.columns.map(c => c.name), ["EventID", "Edep", "Volume"]); assert.equal(p.columns[1].type, "double");
  const s = suggestColumns(p); assert.deepEqual(s.energy, [1]); assert.equal(s.event, 0); assert.deepEqual(s.numeric, [true, true, false]);
});
test("header with a non-comma separator code (59 = ';') is honoured", () => {
  const p = parseGeant4("#class tools::wcsv::ntuple\n#title t\n#separator 59\n#vector_separator 124\n#column double Edep\n#column int EventID\n1.5;0\n2.5;1\n");
  assert.equal(p.separator, ";"); assert.equal(p.rows.length, 2);
});
test("Hippo header (title line + tab-separated names)", () => {
  const p = parseGeant4("Neutron hits\nEventID\tEdep\n0\t1.5\n1\t2.5\n"); assert.equal(p.format, "geant4-csv-hippo-header"); assert.deepEqual(p.columns.map(c => c.name), ["EventID", "Edep"]);
});
test("plain CSV with header row and headerless numeric column", () => {
  assert.equal(parseGeant4("Edep\n1\n2\n").format, "csv-with-header-row");
  const h = parseGeant4("1.5\n2.5\n"); assert.equal(h.format, "csv-headerless"); assert.ok(h.warnings.length);
});
test("unsupported formats fail with explicit messages (no guessing)", () => {
  assert.throws(() => parseGeant4("root\u0000\u0000\u0001"), /ROOT\/HDF5/); assert.throws(() => parseGeant4("<?xml version='1.0'?><aida/>"), /XML/);
  assert.throws(() => parseGeant4("#class tools::histo::h1d\n#title x\n1,2"), /histograma/); assert.throws(() => parseGeant4("#class tools::wcsv::ntuple\n#title t\n1\n"), /#column/);
  assert.throws(() => parseGeant4("#class tools::wcsv::ntuple\n#column double E\n"), /no contiene filas/);
});
test("malformed rows are skipped with a warning, not silently fixed", () => {
  const p = parseGeant4(HDR + "0,1.5,Si\n1,2\n2,3,Si\n"); assert.equal(p.rows.length, 2); assert.ok(p.warnings.some(w => /2 campos/.test(w)));
});
test("unit conversion to MeV (eV, keV, GeV, J) and validation of bad values", () => {
  const p = parseGeant4("Edep\n1000\n2500\n");
  assert.deepEqual(extractEnergies(p, { energyColumn: 0, unit: "keV", rowsAreEvents: true }).edepMeV, [1, 2.5]);
  assert.deepEqual(extractEnergies(p, { energyColumn: 0, unit: "eV", rowsAreEvents: true }).edepMeV, [0.001, 0.0025]);
  assert.ok(Math.abs(extractEnergies(parseGeant4("E\n1.602176634e-13\n"), { energyColumn: 0, unit: "J", rowsAreEvents: true }).edepMeV[0] - 1) < 1e-12);
  assert.throws(() => extractEnergies(p, { energyColumn: 0, unit: "furlong", rowsAreEvents: true }), /Unidad/);
  assert.throws(() => extractEnergies(parseGeant4("Edep\n1\n-2\n"), { energyColumn: 0, unit: "MeV", rowsAreEvents: true }), /negativa/);
  assert.throws(() => extractEnergies(parseGeant4("Edep\n1\nabc\n"), { energyColumn: 0, unit: "MeV", rowsAreEvents: true }), /no es un número/);
});
test("without an event column the user must confirm that each row is an event", () => {
  const p = parseGeant4("Edep\n1\n2\n"); assert.throws(() => extractEnergies(p, { energyColumn: 0, unit: "MeV" }), /cada fila es un evento/);
});
test("step-level data are summed per event id (never mixing steps as events)", () => {
  const p = parseGeant4(HDR + "0,1,Si\n0,0.5,Si\n1,2,Si\n2,0.25,Si\n2,0.25,Si\n");
  const r = extractEnergies(p, { energyColumn: 1, eventColumn: 0, unit: "MeV" }); assert.deepEqual(r.edepMeV, [1.5, 2, 0.5]); assert.equal(r.aggregated, true); assert.equal(r.rowsRead, 5);
});
test("vector columns cannot be used as energy", () => {
  const p = parseGeant4("#class tools::wcsv::ntuple\n#title t\n#separator 44\n#vector_separator 59\n#column std::vector<double> Steps\n#column double Edep\n1;2;3,6\n4;5,9\n");
  assert.equal(p.columns[0].vector, true); assert.throws(() => extractEnergies(p, { energyColumn: 0, unit: "MeV", rowsAreEvents: true }), /vectorial/);
});
test("CRLF files and BOM are accepted", () => assert.equal(parseGeant4("\uFEFFEdep\r\n1\r\n2\r\n").rows.length, 2));
