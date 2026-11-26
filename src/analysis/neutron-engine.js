/**
 * Neutron energy-deposition engine — THE single statistics/graph-data engine used by both the manual
 * and the AI-assisted modes (see src/analysis/neutron-service.js). Pure functions, no DOM.
 *
 * Definitions (N = simulated events, k = events with E_dep > 0, E_i in MeV):
 *  1. f      = k / N                              interaction (deposition) fraction; Wilson 95 % interval.
 *  2. <E>    = (1/N) Σ E_i                        mean energy per event (all events, zeros included) ± s/√N.
 *                                                 Proportional to the absorbed dose per primary neutron (D = ΣE / m).
 *  3. median = Q(0.5) of {E_i : E_i > 0}          typical deposit given that energy was deposited (robust).
 *  4. P95    = Q(0.95) of {E_i : E_i > 0}         tail of the deposit distribution (high-energy events).
 *  5. IQR    = Q(0.75) − Q(0.25) of {E_i > 0}     robust spread of the deposit given a deposit.
 * Quantiles: linear interpolation, "type 7" (same convention as statistics.js, R type 7, NumPy default).
 */
import { quantile } from "./statistics.js";

export const Z95 = 1.959963984540054;

/** Wilson score interval for a binomial proportion. */
export function wilsonInterval(k, n, z = Z95) {
  if (!(n > 0)) return { low: null, high: null };
  const p = k / n, z2 = z * z, den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den, half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / den;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Mean and standard error over N events where only the k positive values are listed (rest are zeros). */
export function meanWithZeros(positives, N) {
  const k = positives.length;
  if (N < 1) return { mean: null, sem: null };
  let m = 0, m2 = 0;                                  // Welford over the positives
  for (let i = 0; i < k; i++) { const d = positives[i] - m; m += d / (i + 1); m2 += d * (positives[i] - m); }
  const mean = (k * m) / N, z = N - k;
  const ss = m2 + (k ? k * (m - mean) ** 2 : 0) + z * mean * mean;   // Σ(x−mean)² including zeros
  return { mean, sem: N > 1 ? Math.sqrt(ss / (N - 1)) / Math.sqrt(N) : null };
}

export function buildBins(positives, { bins = "auto", scale = "auto" } = {}) {
  if (!positives.length) return { edges: [], counts: [], scale: "linear", nBins: 0 };
  let lo = Infinity, hi = -Infinity;
  for (const v of positives) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const nBins = bins === "auto" ? Math.min(200, Math.max(10, Math.ceil(Math.log2(positives.length)) + 1)) : Math.max(1, Math.min(500, Math.floor(bins)));
  // "auto": log bins only if the BULK of the deposits spans orders of magnitude (P95/P5 > 100). Min/max alone is too sensitive to one tiny event.
  const spread = () => { const a = quantile(positives, 0.05), b = quantile(positives, 0.95); return a > 0 ? b / a : Infinity; };
  const useLog = scale === "log" || (scale === "auto" && lo > 0 && spread() > 100);
  if (hi === lo) { const e = [lo * 0.99, lo * 1.01]; return { edges: e, counts: [positives.length], scale: "linear", nBins: 1 }; }
  const edges = Array.from({ length: nBins + 1 }, (_, i) => useLog ? lo * (hi / lo) ** (i / nBins) : lo + ((hi - lo) * i) / nBins);
  edges[nBins] = hi;
  const counts = new Array(nBins).fill(0);
  for (const v of positives) {
    let j;
    if (useLog) j = Math.floor((Math.log(v / lo) / Math.log(hi / lo)) * nBins); else j = Math.floor(((v - lo) / (hi - lo)) * nBins);
    counts[Math.min(nBins - 1, Math.max(0, j))]++;
  }
  return { edges, counts, scale: useLog ? "log" : "linear", nBins };
}

/** @param {object} dataset canonical dataset  @param {{bins?:"auto"|number, scale?:"auto"|"linear"|"log"}} options */
export function analyzeDeposition(dataset, options = {}) {
  const N = dataset.nEvents, positives = dataset.edepMeV.filter(v => v > 0);
  const k = positives.length, notes = [];
  const f = N > 0 ? k / N : null, ci = wilsonInterval(k, N), { mean, sem } = meanWithZeros(positives, N);
  const q = p => (k ? quantile(positives, p) : null);
  const med = q(0.5), p95 = q(0.95), q1 = q(0.25), q3 = q(0.75), iqr = k ? q3 - q1 : null;
  if (dataset.nEventsAssumed) notes.push("N (eventos simulados) se ha supuesto igual al número de filas: si el archivo solo registra eventos con depósito, la fracción de interacción y la media por evento estarán sobreestimadas. Indique el total de eventos simulados.");
  if (k === 0) notes.push("Ningún evento depositó energía: no hay espectro ni indicadores condicionados.");
  if (k > 0 && k < 30) notes.push(`Solo ${k} eventos con depósito: los percentiles tienen incertidumbre estadística alta.`);
  const hist = buildBins(positives, options), widths = hist.counts.map((_, i) => hist.edges[i + 1] - hist.edges[i]);
  const density = hist.counts.map((c, i) => (N > 0 && widths[i] > 0 ? c / (N * widths[i]) : 0));   // (1/N)·dN/dE  [MeV⁻¹]
  const indicators = [
    { id: "interaction_fraction", label: "Fracción de interacción f", value: f, unit: "", ci95: [ci.low, ci.high], definition: "k/N: eventos con E_dep>0 entre eventos simulados (IC 95 % de Wilson)", why: "Probabilidad de que un neutrón primario deposite energía en el volumen sensible (eficiencia de interacción)." },
    { id: "mean_energy_per_event", label: "Energía media por evento, E_media", value: mean, unit: "MeV", uncertainty: sem, definition: "ΣE/N con ceros incluidos; incertidumbre = error estándar de la media", why: "Proporcional a la dosis absorbida por neutrón primario (D = ΣE/m)." },
    { id: "median_deposit", label: "Mediana del depósito (E>0)", value: med, unit: "MeV", definition: "Q(0,5) de los eventos con E_dep>0", why: "Valor típico, robusto frente a colas largas." },
    { id: "p95_deposit", label: "Percentil 95 (E>0)", value: p95, unit: "MeV", definition: "Q(0,95) de los eventos con E_dep>0", why: "Cola de alta energía, relevante para umbrales de daño o detección." },
    { id: "iqr_deposit", label: "Rango intercuartílico (E>0)", value: iqr, unit: "MeV", definition: "Q(0,75)−Q(0,25) de los eventos con E_dep>0", why: "Dispersión robusta del depósito, sin supuestos de normalidad." }
  ];
  return {
    schema: "data-analyzer.neutron-edep-result/1", datasetId: dataset.id, nEvents: N, nPositive: k, nZero: N - k, notes,
    maxDepositMeV: k ? positives.reduce((a, b) => (b > a ? b : a), -Infinity) : null,
    histogram: { edges: hist.edges, counts: hist.counts, density, scale: hist.scale, nBins: hist.nBins, densityUnit: "MeV⁻¹", definition: "Densidad por evento simulado: (1/N)·ΔN/ΔE, solo eventos con E_dep>0" },
    indicators
  };
}
