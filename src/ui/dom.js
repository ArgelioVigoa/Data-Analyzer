/** Tiny DOM helper: builds elements with textContent only (no innerHTML), so file names, notes and AI text can never inject markup. */
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(n.dataset, v); else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
export const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
export const fmtNum = x => (x == null ? "n/d" : (x !== 0 && (Math.abs(x) >= 1e4 || Math.abs(x) < 1e-3) ? x.toExponential(3) : String(+x.toPrecision(5))));
