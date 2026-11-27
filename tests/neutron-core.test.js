import test from "node:test"; import assert from "node:assert/strict";
import { createCanonicalDataset, validateEnergies, DatasetError, describeDataset } from "../src/data/canonical-dataset.js";
import { analyzeDeposition, wilsonInterval, meanWithZeros } from "../src/analysis/neutron-engine.js";
import { buildFigure } from "../src/analysis/neutron-figure.js";
import { runAnalysis } from "../src/analysis/neutron-service.js";
import { runNeutronDemo, mulberry32, validateParams } from "../src/simulation/neutron-demo.js";
import { DataSourceManager } from "../src/data/data-source-manager.js";
import { CHART_CATALOG, isAvailable } from "../src/analysis/chart-catalog.js";
const ds = (e, N = null) => createCanonicalDataset({ sourceType: "manual-table", name: "t", edepMeV: e, nEventsTotal: N });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b} (tol ${tol})`);
const ind = (r, id) => r.indicators.find(i => i.id === id);

test("validation rejects negative, non-finite, empty and inconsistent totals", () => {
  assert.ok(validateEnergies([1, -1]).errors[0].includes("negativo"));
  assert.ok(validateEnergies([1, NaN]).errors.length); assert.ok(validateEnergies([]).errors.length);
  assert.ok(validateEnergies([1, 2, 3], { nEventsTotal: 2 }).errors[0].includes("no puede ser menor"));
  assert.throws(() => ds([-1]), DatasetError);
});
test("five indicators have hand-computed values (zeros included in N)", () => {
  const r = analyzeDeposition(ds([0, 0, 1, 2, 3, 4, 5], 7));          // N=7, k=5, positives 1..5
  near(ind(r, "interaction_fraction").value, 5 / 7, 1e-12); near(ind(r, "mean_energy_per_event").value, 15 / 7, 1e-12);
  assert.equal(ind(r, "median_deposit").value, 3); near(ind(r, "p95_deposit").value, 4.8, 1e-12); assert.equal(ind(r, "iqr_deposit").value, 2);
  assert.equal(r.indicators.length, 5);
  // SEM with zeros: sample sd of [0,0,1,2,3,4,5] / sqrt(7)
  const x = [0, 0, 1, 2, 3, 4, 5], m = 15 / 7, sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / 6);
  near(ind(r, "mean_energy_per_event").uncertainty, sd / Math.sqrt(7), 1e-12);
});
test("meanWithZeros equals the naive computation over the padded array", () => {
  const pos = [0.5, 2.5, 1.25, 9, 0.01], N = 12, full = [...pos, ...Array(N - pos.length).fill(0)];
  const m = full.reduce((a, b) => a + b) / N, s = Math.sqrt(full.reduce((a, v) => a + (v - m) ** 2, 0) / (N - 1)) / Math.sqrt(N);
  const r = meanWithZeros(pos, N); near(r.mean, m, 1e-12); near(r.sem, s, 1e-12);
});
test("Wilson interval matches known reference values", () => {
  const w = wilsonInterval(0, 10); near(w.low, 0, 1e-12); near(w.high, 0.2775, 5e-4);   // Wilson 0/10 -> [0, 0.2775]
  const h = wilsonInterval(50, 100); near(h.low, 0.4038, 5e-4); near(h.high, 0.5962, 5e-4);
});
test("histogram conserves counts and density integrates to k/N", () => {
  const sim = runNeutronDemo({ nEvents: 50000, seed: 7 }), d = createCanonicalDataset({ sourceType: "demo-simulation", name: "d", edepMeV: sim.edepMeV, nEventsTotal: sim.nEvents });
  for (const scale of ["linear", "log"]) {
    const r = analyzeDeposition(d, { scale }), h = r.histogram;
    assert.equal(h.counts.reduce((a, b) => a + b, 0), r.nPositive);
    const integral = h.density.reduce((s, y, i) => s + y * (h.edges[i + 1] - h.edges[i]), 0);
    near(integral, r.nPositive / r.nEvents, 1e-9, `∫ density (${scale})`);
  }
});
test("demo simulation reproduces its own analytic model within statistical error", () => {
  const sim = runNeutronDemo({ nEvents: 400000, seed: 2024 }), d = createCanonicalDataset({ sourceType: "demo-simulation", name: "d", edepMeV: sim.edepMeV, nEventsTotal: sim.nEvents });
  const r = analyzeDeposition(d), e = sim.expected, E0 = sim.parameters.energyMeV;
  const f = ind(r, "interaction_fraction"); near(f.value, e.interactionProbability, 4 * Math.sqrt(e.interactionProbability * (1 - e.interactionProbability) / sim.nEvents), "f");
  const m = ind(r, "mean_energy_per_event"); near(m.value, e.meanEnergyMeV, 4 * m.uncertainty, "<E>");
  near(ind(r, "median_deposit").value, E0 / 2, 0.02 * E0, "median"); near(ind(r, "p95_deposit").value, 0.95 * E0, 0.02 * E0, "P95"); near(ind(r, "iqr_deposit").value, E0 / 2, 0.03 * E0, "IQR");
  assert.ok(r.maxDepositMeV <= E0, "no deposit above the neutron energy (energy conservation)");
});
test("demo simulation is reproducible per seed, differs across seeds, and validates inputs", () => {
  const a = runNeutronDemo({ nEvents: 1000, seed: 1 }).edepMeV, b = runNeutronDemo({ nEvents: 1000, seed: 1 }).edepMeV, c = runNeutronDemo({ nEvents: 1000, seed: 2 }).edepMeV;
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.throws(() => runNeutronDemo({ nEvents: -5 }), RangeError); assert.ok(validateParams({ nEvents: 10, energyMeV: 2, sigmaBarn: 2, thicknessCm: 1, densityGcm3: 1, seed: 1.5 }).length);
  const thick = runNeutronDemo({ nEvents: 10, thicknessCm: 50 }); assert.ok(thick.warnings.length, "thick slab warns that multiple scattering is ignored");
  const g = mulberry32(5), v = Array.from({ length: 1000 }, g); assert.ok(v.every(x => x >= 0 && x < 1));
});
test("provenance is kept and the demo is explicitly labelled as NOT GEANT4", () => {
  const m = new DataSourceManager(), d = m.fromDemo({ nEvents: 100 });
  assert.equal(d.sourceType, "demo-simulation"); assert.match(d.name, /no GEANT4/i); assert.match(d.provenance.origin, /NO es una simulación GEANT4/); assert.ok(d.provenance.parameters && d.provenance.assumptions.length >= 4);
});
test("manual table: parsing, unit conversion, decimal-comma rejection and totals", () => {
  const m = new DataSourceManager();
  const d = m.fromManualRows([{ value: "500" }, { value: "" }, { value: "1500" }], { unit: "keV" });
  assert.deepEqual(d.edepMeV, [0.5, 1.5]); assert.equal(d.nEvents, 2); assert.equal(d.nEventsAssumed, true);
  assert.throws(() => m.fromManualRows([{ value: "1,5" }]), /punto decimal/); assert.throws(() => m.fromManualRows([{ value: "abc" }]), DatasetError);
  assert.throws(() => m.fromManualRows([{ value: "1" }, { value: "2" }], { nEventsTotal: 1 }), /no puede ser menor/);
});
test("ONE engine: identical energies give identical results whatever the source", () => {
  const m = new DataSourceManager(), E = [0, 0.3, 0, 1.2, 2.2, 0.7, 0, 0, 1.9, 0.05];
  const manual = m.fromManualRows(E.map(v => ({ value: String(v) })), { unit: "MeV" });
  const parsed = m.inspectGeant4("#class tools::wcsv::ntuple\n#title t\n#separator 44\n#vector_separator 59\n#column double Edep\n" + E.join("\n"), "x.csv").parsed;
  const g4 = m.fromGeant4(parsed, { energyColumn: 0, unit: "MeV", rowsAreEvents: true });
  const a = runAnalysis(manual).result, b = runAnalysis(g4).result;
  assert.deepEqual(a.indicators, b.indicators); assert.deepEqual(a.histogram, b.histogram);
});
test("statistics toggle changes only overlays, never the data or the histogram", () => {
  const d = ds([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 20), on = runAnalysis(d, { showStats: true }), off = runAnalysis(d, { showStats: false });
  assert.deepEqual(on.figure.data, off.figure.data); assert.deepEqual(on.result, off.result);
  assert.equal(off.figure.layout.shapes.length, 0); assert.equal(off.figure.layout.annotations.length, 0);
  assert.ok(on.figure.layout.shapes.length >= 2); const box = on.figure.layout.annotations.at(-1).text;
  for (const t of ["f</b>", "E<sub>media", "mediana", "P95", "IQR"]) assert.ok(box.includes(t), t);
});
test("figure has labelled axes with units, readable fonts, and handles the all-zero case", () => {
  const f = buildFigure(analyzeDeposition(ds([1, 2, 3, 2, 1, 2])), { showStats: false });
  assert.match(f.layout.xaxis.title.text, /MeV/); assert.match(f.layout.yaxis.title.text, /MeV⁻¹/);
  assert.ok(f.layout.xaxis.title.font.size >= 14 && f.layout.xaxis.tickfont.size >= 12 && f.layout.title.font.size >= 16);
  const z = buildFigure(analyzeDeposition(ds([0, 0, 0], 3)), { showStats: true }); assert.ok(z.layout.annotations.some(a => /Ningún evento/.test(a.text)));
  assert.equal(analyzeDeposition(ds([0, 0, 0], 3)).indicators.find(i => i.id === "median_deposit").value, null);
});
test("assuming N = rows is flagged; giving the total removes the flag", () => {
  assert.ok(analyzeDeposition(ds([1, 2])).notes.some(n => /supuesto/.test(n))); assert.ok(!analyzeDeposition(ds([1, 2], 10)).notes.some(n => /supuesto/.test(n)));
});
test("chart catalogue: six charts, five locked, only the neutron one available", () => {
  assert.equal(CHART_CATALOG.length, 6); assert.deepEqual(CHART_CATALOG.filter(c => c.status === "locked").map(c => c.n), [1, 2, 3, 4, 5]);
  assert.deepEqual(CHART_CATALOG.filter(c => isAvailable(c.id)).map(c => c.n), [6]); assert.throws(() => { CHART_CATALOG[0].status = "available"; });
});
test("describeDataset never contains raw values", () => assert.ok(!("edepMeV" in describeDataset(ds([1, 2, 3])))));
test("Wilson 95% interval has ~95% empirical coverage over 300 independent replicates", () => {
  let hit = 0, P = null; const R = 300;
  for (let seed = 1; seed <= R; seed++) {
    const sim = runNeutronDemo({ nEvents: 2000, seed }); P = sim.expected.interactionProbability;
    const f = ind(analyzeDeposition(createCanonicalDataset({ sourceType: "demo-simulation", name: "d", edepMeV: sim.edepMeV, nEventsTotal: sim.nEvents })), "interaction_fraction");
    if (f.ci95[0] <= P && P <= f.ci95[1]) hit++;
  }
  const cov = hit / R; assert.ok(cov > 0.91 && cov < 0.99, `coverage ${cov} (expected ≈0.95)`);
});
test("auto binning: flat spectrum stays linear; a spectrum spanning decades goes logarithmic; explicit choice is honoured", () => {
  const flat = runNeutronDemo({ nEvents: 20000, seed: 3 }), d1 = createCanonicalDataset({ sourceType: "demo-simulation", name: "d", edepMeV: flat.edepMeV, nEventsTotal: flat.nEvents });
  assert.equal(analyzeDeposition(d1).histogram.scale, "linear");                      // a tiny minimum no longer forces log bins
  const rnd = mulberry32(9), heavy = Array.from({ length: 5000 }, () => 10 ** (-4 + 4 * rnd()));   // log-uniform over 4 decades
  assert.equal(analyzeDeposition(ds(heavy)).histogram.scale, "log");
  assert.equal(analyzeDeposition(d1, { scale: "log" }).histogram.scale, "log"); assert.equal(analyzeDeposition(ds(heavy), { scale: "linear" }).histogram.scale, "linear");
});
test("log-binned figure never uses bar widths on a log axis (they overflow the axis range)", () => {
  const rnd = mulberry32(9), heavy = Array.from({ length: 5000 }, () => 10 ** (-4 + 4 * rnd())), f = buildFigure(analyzeDeposition(ds(heavy)));
  assert.equal(f.layout.xaxis.type, "log"); assert.ok(f.data.every(t => t.type !== "bar")); assert.ok(f.data[0].x.every(x => x > 0));
});
