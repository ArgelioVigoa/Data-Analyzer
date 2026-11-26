/** Builds a Plotly figure specification from an analysis result. Pure (no DOM): easy to test and to render anywhere. */
export const AXES = Object.freeze({
  x: { title: "Energía depositada por evento, E<sub>dep</sub> (MeV)", unit: "MeV" },
  y: { title: "Densidad de eventos, (1/N)·dN/dE (MeV⁻¹)", unit: "MeV⁻¹" }
});
const C = { bar: "#00e5ff", edge: "#7fefff", text: "#e0e0ff", grid: "rgba(160,170,220,.22)", axis: "#a3abd0", median: "#ff9f43", p95: "#ff6b8a" };
const fmt = x => (x == null ? "n/d" : (x !== 0 && (Math.abs(x) >= 1e4 || Math.abs(x) < 1e-3) ? x.toExponential(3) : String(+x.toPrecision(4))));

export function statsText(result) {
  const g = id => result.indicators.find(i => i.id === id);
  const f = g("interaction_fraction"), m = g("mean_energy_per_event");
  return [
    `<b>N</b> = ${result.nEvents} · con depósito: ${result.nPositive}`,
    `<b>f</b> = ${fmt(f.value)}  [${fmt(f.ci95[0])}, ${fmt(f.ci95[1])}]`,
    `<b>E<sub>media</sub></b> = ${fmt(m.value)} ± ${fmt(m.uncertainty)} MeV`,
    `<b>mediana</b> = ${fmt(g("median_deposit").value)} MeV`,
    `<b>P95</b> = ${fmt(g("p95_deposit").value)} MeV`,
    `<b>IQR</b> = ${fmt(g("iqr_deposit").value)} MeV`
  ].join("<br>");
}

export function buildFigure(result, { showStats = true, title = "Energía depositada por neutrones", subtitle = "" } = {}) {
  const h = result.histogram, logx = h.scale === "log";
  const centres = h.counts.map((_, i) => (logx ? Math.sqrt(h.edges[i] * h.edges[i + 1]) : (h.edges[i] + h.edges[i + 1]) / 2));
  const widths = h.counts.map((_, i) => h.edges[i + 1] - h.edges[i]);
  const hover = "E ≈ %{x:.4g} MeV<br>(1/N)dN/dE = %{y:.4g} MeV⁻¹<br>cuentas = %{customdata}<extra></extra>";
  // Linear bins: bars. Log bins: a step outline (bars with `width` are wrong on a log axis) plus an invisible hover layer.
  const stepX = [], stepY = [];
  h.counts.forEach((_, i) => { stepX.push(h.edges[i], h.edges[i + 1]); stepY.push(h.density[i], h.density[i]); });
  const data = logx ? [
    { type: "scatter", mode: "lines", x: stepX, y: stepY, fill: "tozeroy", fillcolor: "rgba(0,229,255,.28)", line: { color: C.bar, width: 2.5 }, hoverinfo: "skip", name: "Eventos con E_dep>0" },
    { type: "scatter", mode: "markers", x: centres, y: h.density, marker: { size: 12, opacity: 0 }, customdata: h.counts, hovertemplate: hover, showlegend: false }
  ] : [{
    type: "bar", x: centres, y: h.density, width: widths, name: "Eventos con E_dep>0",
    marker: { color: C.bar, line: { color: C.edge, width: 1 } }, customdata: h.counts, hovertemplate: hover
  }];
  const axis = (t, log) => ({ title: { text: t, font: { size: 15 }, standoff: 12 }, type: log ? "log" : "linear", tickfont: { size: 13 }, gridcolor: C.grid, linecolor: C.axis, linewidth: 1.5, mirror: true, ticks: "outside", automargin: true, zeroline: false });
  const layout = {
    title: { text: `${title}${subtitle ? `<br><span style="font-size:12px;color:${C.axis}">${subtitle}</span>` : ""}`, font: { size: 18, color: C.text }, x: 0.02, xanchor: "left" },
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(255,255,255,.03)", font: { color: C.text, size: 13 },
    margin: { t: 80, l: 84, r: 24, b: 72 }, bargap: 0, showlegend: false, hovermode: "closest",
    xaxis: axis(AXES.x.title, logx), yaxis: axis(AXES.y.title, false), shapes: [], annotations: []
  };
  if (showStats && result.nPositive > 0) {
    const med = result.indicators.find(i => i.id === "median_deposit").value, p95 = result.indicators.find(i => i.id === "p95_deposit").value;
    const line = (x, c) => ({ type: "line", xref: "x", yref: "paper", x0: x, x1: x, y0: 0, y1: 1, line: { color: c, width: 2, dash: "dash" } });
    layout.margin.r = 250;   // the statistics box lives in the right margin: it never covers the data
    layout.shapes.push(line(med, C.median), line(p95, C.p95));
    layout.annotations.push(
      { xref: "x", yref: "paper", x: med, y: 1, text: "mediana", showarrow: false, yanchor: "bottom", font: { color: C.median, size: 12 } },
      { xref: "x", yref: "paper", x: p95, y: 1, text: "P95", showarrow: false, yanchor: "bottom", font: { color: C.p95, size: 12 } },
      { xref: "paper", yref: "paper", x: 1.02, y: 1, xanchor: "left", yanchor: "top", align: "left", showarrow: false, text: statsText(result), bgcolor: "rgba(5,5,16,.82)", bordercolor: C.axis, borderwidth: 1, borderpad: 8, font: { size: 13, color: C.text } });
  }
  if (result.nPositive === 0) layout.annotations.push({ xref: "paper", yref: "paper", x: .5, y: .5, showarrow: false, text: "Ningún evento depositó energía: no hay espectro que representar", font: { size: 15, color: C.p95 } });
  return { data, layout, config: { responsive: true, displaylogo: false, toImageButtonOptions: { format: "png", scale: 2, filename: "energia_depositada_neutrones" } } };
}
