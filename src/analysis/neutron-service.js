/**
 * The ONE entry point to analysis. The manual UI and the AI-assisted UI/AI Core both call `runAnalysis`,
 * which delegates to the single engine in neutron-engine.js and the single figure builder in neutron-figure.js.
 */
import { analyzeDeposition } from "./neutron-engine.js";
import { buildFigure } from "./neutron-figure.js";
export const ENGINE_ID = "neutron-engine/1";
export function runAnalysis(dataset, { bins = "auto", scale = "auto", showStats = true } = {}) {
  const result = analyzeDeposition(dataset, { bins, scale });
  const figure = buildFigure(result, { showStats, subtitle: `${dataset.name} · fuente: ${dataset.sourceType}` });
  return { engine: ENGINE_ID, result, figure };
}
