/**
 * Context Builder: selects ONLY what a future model may see. Raw event values are never included
 * (unless the user explicitly enables includeRawData, which still sends only a bounded head sample).
 * Returns the context plus a transparent report of what was included/excluded and its size.
 */
import { describeDataset } from "../data/canonical-dataset.js";
const PROV_ALLOWED = ["origin", "modelId", "parserFormat", "declaredUnit", "convertedTo", "energyColumn", "eventColumn", "aggregatedPerEvent", "parameters", "rows", "rowsRead"];
export function buildContext({ dataset, analysis = null, objective = "", settings = {} }) {
  const maxChars = settings.maxContextChars ?? 6000;
  if (!dataset) return { context: { dataset: null }, report: { included: [], excluded: ["dataset"], chars: 0, truncated: false } };
  const d = describeDataset(dataset), prov = {};
  for (const k of PROV_ALLOWED) if (k in d.provenance) prov[k] = d.provenance[k];
  const ctx = {
    schema: "data-analyzer.ai-context/1",
    dataset: { id: d.id, name: d.name, sourceType: d.sourceType, nEvents: d.nEvents, nRecorded: d.nRecorded, nEventsAssumed: d.nEventsAssumed, quantity: d.quantity, provenance: prov, warnings: d.warnings },
    variables: [{ name: "E_dep", description: "Energía depositada por evento en el volumen sensible", unit: "MeV" }]
  };
  if (analysis) {
    ctx.indicators = analysis.result.indicators.map(i => ({ id: i.id, value: i.value, unit: i.unit, uncertainty: i.uncertainty ?? null, ci95: i.ci95 ?? null }));
    ctx.histogram = { scale: analysis.result.histogram.scale, nBins: analysis.result.histogram.nBins, range: analysis.result.nPositive ? [analysis.result.histogram.edges[0], analysis.result.histogram.edges.at(-1)] : null };
    ctx.analysisNotes = analysis.result.notes;
  }
  const included = ["dataset.id", "dataset.name", "dataset.sourceType", "dataset.counts", "dataset.provenance(selected)", "variables", ...(analysis ? ["indicators", "histogram.summary", "analysisNotes"] : [])];
  const excluded = ["valores individuales de energía", "nombre de archivo original", "contenido del archivo"];
  if (objective) ctx.objective = String(objective).slice(0, 500), included.push("objective");
  if (settings.includeRawData) { ctx.sample = dataset.edepMeV.slice(0, 50); included.push("sample(primeros 50 valores)"); excluded.shift(); }
  let json = JSON.stringify(ctx), truncated = false;
  if (json.length > maxChars) { delete ctx.sample; delete ctx.analysisNotes; truncated = true; json = JSON.stringify(ctx); }
  if (json.length > maxChars) throw new Error(`El contexto (${json.length} caracteres) supera el límite (${maxChars}).`);
  return { context: ctx, report: { included, excluded, chars: json.length, truncated } };
}
