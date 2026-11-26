/** Extensible registry of the six scientific charts. Only `neutron-edep` is operational in this stage; the rest are registered, locked and not executable. */
export const CHART_CATALOG = Object.freeze([
  { id: "t2-coherence", n: 1, title: "Tiempo de Coherencia (T₂) vs. Material / Estructura", status: "locked" },
  { id: "fourier-bars", n: 2, title: "Barras de Coeficientes de Fourier (Simulación de Respuesta Dinámica)", status: "locked" },
  { id: "energy-spectrum", n: 3, title: "Espectro de Energía vs. Parámetro del Material", status: "locked" },
  { id: "parity-plot", n: 4, title: "Dispersión «Parity Plot» (Modelo vs. Simulación)", status: "locked" },
  { id: "decoherence-rate", n: 5, title: "Tasa de Relajación / Decoherencia vs. Temperatura o Ruido", status: "locked" },
  { id: "neutron-edep", n: 6, title: "Energía Depositada por Neutrones (distribución de energía depositada — simulación GEANT4)", status: "available" }
].map(Object.freeze));
export const isAvailable = id => CHART_CATALOG.find(c => c.id === id)?.status === "available";
export const getChart = id => CHART_CATALOG.find(c => c.id === id) ?? null;
