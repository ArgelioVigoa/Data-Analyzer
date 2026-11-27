/**
 * DEMONSTRATION MODEL — NOT GEANT4, NOT a transport code.
 * Model id: "neutron-np-single-scatter/1". See docs/neutron-demo-model.md for derivation and limits.
 *
 * Physics: mono-energetic fast neutrons (energy E0) at normal incidence on a hydrogenous slab (polyethylene (CH2)n).
 *  1. Interaction: the neutron scatters elastically off hydrogen with probability P = 1 − exp(−Σ·t),
 *     Σ = N_H·σ_np, N_H = 2·ρ·N_A/M_CH2.  (Carbon scattering/capture, gammas and multiple scattering are ignored.)
 *  2. n–p elastic scattering is isotropic in the centre-of-mass frame below ~10 MeV, so the recoil-proton energy
 *     E_p = E0·cos²θ_lab is UNIFORMLY distributed on [0, E0]  (the textbook "box" proton-recoil spectrum).
 *  3. The recoil proton (range ≪ slab thickness) deposits all its energy locally; the scattered neutron is assumed to escape.
 * Analytic expectations used by the tests: f = P, ⟨E⟩ = P·E0/2, median(E|E>0) = E0/2, P95 = 0.95·E0, IQR = E0/2.
 * Pseudo-random numbers come from a seeded generator (reproducible); they are the Monte-Carlo sampling of THIS model,
 * not an experimental or GEANT4 result.
 */
export const MODEL = Object.freeze({
  id: "neutron-np-single-scatter/1",
  label: "Modelo demostrativo simplificado (dispersión elástica n–p única). NO es una simulación GEANT4.",
  assumptions: [
    "Neutrones monoenergéticos a incidencia normal sobre una lámina de polietileno (CH2)n.",
    "Solo dispersión elástica n–p con sección eficaz constante σ_np (valor de entrada); se ignoran el carbono, captura, rayos gamma y dispersión múltiple.",
    "Dispersión isótropa en el sistema CM (válida por debajo de ~10 MeV): energía del protón de retroceso uniforme en [0, E0].",
    "El protón de retroceso deposita toda su energía en la lámina; el neutrón dispersado escapa sin más interacciones.",
    "Sin resolución del detector ni extinción (quenching)."
  ],
  validity: "Cualitativo: ilustra el flujo de datos. No usar para predicciones cuantitativas."
});
export const DEFAULTS = Object.freeze({ nEvents: 20000, energyMeV: 2.45, sigmaBarn: 2.6, thicknessCm: 1.0, densityGcm3: 0.94, seed: 12345 });
const NA = 6.02214076e23, M_CH2 = 14.0266;   // g/mol, (12.011 + 2·1.008)

/** mulberry32: small, fast, seedable PRNG with 32-bit state. */
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function validateParams(p) {
  const e = [];
  const chk = (v, n, min, max, int = false) => { if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) e.push(`${n} debe ser ${int ? "un entero " : "un número "}entre ${min} y ${max}.`); };
  chk(p.nEvents, "Número de eventos", 1, 1_000_000, true); chk(p.energyMeV, "Energía del neutrón (MeV)", 0.01, 10);
  chk(p.sigmaBarn, "σ_np (barn)", 0.01, 100); chk(p.thicknessCm, "Espesor (cm)", 0.001, 100);
  chk(p.densityGcm3, "Densidad (g/cm³)", 0.1, 3); chk(p.seed, "Semilla", 0, 4294967295, true);
  return e;
}

/** @returns {{edepMeV:number[], nEvents:number, parameters:object, model:object, expected:object, warnings:string[]}} */
export function runNeutronDemo(overrides = {}) {
  const p = { ...DEFAULTS, ...overrides }, errs = validateParams(p);
  if (errs.length) throw new RangeError(errs[0]);
  const nH = (2 * p.densityGcm3 * NA) / M_CH2, sigmaMacro = nH * p.sigmaBarn * 1e-24, tau = sigmaMacro * p.thicknessCm;
  const P = 1 - Math.exp(-tau), rnd = mulberry32(p.seed), edepMeV = new Array(p.nEvents), warnings = [];
  for (let i = 0; i < p.nEvents; i++) edepMeV[i] = rnd() < P ? p.energyMeV * rnd() : 0;
  if (tau > 0.3) warnings.push(`Σ·t = ${tau.toFixed(2)} > 0,3: la dispersión múltiple (ignorada por el modelo) ya sería importante.`);
  return {
    edepMeV, nEvents: p.nEvents, parameters: { ...p }, model: MODEL, warnings,
    expected: { interactionProbability: P, meanEnergyMeV: (P * p.energyMeV) / 2, medianPositiveMeV: p.energyMeV / 2, p95PositiveMeV: 0.95 * p.energyMeV, iqrPositiveMeV: p.energyMeV / 2, macroscopicXsPerCm: sigmaMacro }
  };
}
