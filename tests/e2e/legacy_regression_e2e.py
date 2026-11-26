"""Regresión del analizador de archivos heredado (File Explorer → Analizar). Mismas condiciones que neutron_analysis_e2e.py."""
import os,sys,math,json
from playwright.sync_api import sync_playwright
src=open(os.path.join(os.path.dirname(__file__),'neutron_analysis_e2e.py'),encoding='utf-8').read().split('G4=')[0]
exec(src)
CSV="t,A\n0,1000\n10,819\n20,670\n30,549\n40,449\n50,368\n60,301\n70,247\n80,202\n90,165\n100,135\n"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1366,"height":900}); ctx.route("**/*",route); pg=ctx.new_page(); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)[:200]))
    pg.goto(BASE+"index.html"); pg.click("#enter"); pg.wait_for_timeout(900); pg.evaluate("go('files')")
    pg.set_input_files("#up",{"name":"decay.csv","mimeType":"text/csv","buffer":CSV.encode()}); pg.click("button:has-text('Cargar')"); pg.wait_for_timeout(800)
    pg.click("#filel button:has-text('Analizar')"); pg.wait_for_timeout(1500)
    txt=pg.inner_text("#analysis-panel, #app, body")
    chk("Legacy: análisis de archivo abre y muestra pestañas", pg.locator(".tabs button").count()>=5, pg.locator(".tabs button").count())
    pg.click(".tabs button:has-text('Statistical Summary')"); pg.wait_for_timeout(500); body=pg.inner_text("body")
    chk("Legacy: Statistical Summary calcula media de A = 445.909", "445.9" in body, "")
    pg.click(".tabs button:has-text('Variable Relationships')"); pg.wait_for_timeout(800); body=pg.inner_text("body")
    chk("Legacy: correlación (Pearson) calculada", "Pearson" in body or "r=" in body or "−0" in body or "-0.9" in body)
    pg.click(".tabs button:has-text('Regression')"); pg.wait_for_timeout(500); pg.click("button:has-text('Ajustar')"); pg.wait_for_timeout(1500)
    chk("Legacy: regresión produce R²", "R²" in pg.inner_text("body"))
    chk("Sin errores JS", not errs, errs[:2]); b.close()
