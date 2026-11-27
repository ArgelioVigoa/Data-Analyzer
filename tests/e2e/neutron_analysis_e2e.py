"""E2E (Chromium) del flujo de análisis. Uso: python3 -m http.server 8780 & ; PLOTLY_JS=<ruta a plotly.min.js 2.35.2> python3 tests/e2e/neutron_analysis_e2e.py"""
import json,sys,math,os
from playwright.sync_api import sync_playwright
PLOTLY=open(__import__("os").environ.get("PLOTLY_JS","plotly.min.js"),"rb").read()
BASE="http://localhost:8780/"; res=[]
def chk(n,c,d=""):
    res.append((n,bool(c),str(d))); print(("PASS " if c else "FAIL ")+n+((" — "+str(d)) if d and not c else ""))
def route(r):
    u=r.request.url
    if u.startswith("http://localhost:8780"): return r.continue_()
    if "plotly" in u: return r.fulfill(status=200,content_type="application/javascript",body=PLOTLY)
    return r.abort()
G4="#class tools::wcsv::ntuple\n#title Edep per event\n#separator 44\n#vector_separator 59\n#column int EventID\n#column double Edep\n"+"\n".join(f"{i},{v}" for i,v in enumerate([0,0.5,0,1.2,2.2,0.7,0,0,1.9,0.05,0,0.9]))+"\n"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1366,"height":900}); ctx.route("**/*",route); pg=ctx.new_page(); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)[:200]))
    pg.on("console",lambda m:errs.append("console:"+m.text[:160]) if m.type=="error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE+"index.html"); pg.click("#enter"); pg.wait_for_timeout(1200)
    pg.click(".hl .cta button:has-text('Seleccionar archivo')"); pg.wait_for_selector("#analysis.on")
    chk("CTA principal abre 'Seleccionar archivo para analizar'", pg.is_visible("#modeManual") and pg.is_visible("#modeAI"))
    chk("Dos flujos diferenciados (manual / IA)", "manual" in pg.get_attribute("#modeManual","class") and "ai" in pg.get_attribute("#modeAI","class"))
    # --- manual
    pg.click("#modeManual"); cards=pg.eval_on_selector_all(".chart-card","e=>e.map(x=>[x.dataset.chart,x.disabled,x.classList.contains('locked')])")
    chk("Catálogo con 6 gráficos", len(cards)==6, cards); chk("Gráficos 1–5 bloqueados y deshabilitados", all(c[1] and c[2] for c in cards[:5]))
    chk("Gráfico 6 operativo", cards[5]==["neutron-edep",False,False])
    pg.click(".chart-card.locked >> nth=0",force=True); pg.wait_for_timeout(200); chk("Clic en gráfico bloqueado no abre nada", pg.locator("[data-testid=src-geant4]").count()==0 and pg.locator("#nrPlot").count()==0)
    pg.click("[data-chart=neutron-edep]"); pg.wait_for_selector("[data-testid=src-geant4]")
    chk("Gráfico 6 muestra las 3 fuentes (A/B/C)", pg.locator("[data-source]").count()==3)
    # A: archivo GEANT4
    pg.set_input_files("#g4file",{"name":"run1.csv","mimeType":"text/csv","buffer":G4.encode()}); pg.wait_for_selector("#g4use")
    chk("Detecta columna Edep y EventID", pg.eval_on_selector("#g4energy","e=>e.options[e.selectedIndex].text").startswith("Edep") and pg.eval_on_selector("#g4event","e=>e.options[e.selectedIndex].text")=="EventID")
    pg.fill("#g4total","24"); pg.click("#g4use"); pg.wait_for_selector("#nrPlot.js-plotly-plot",timeout=10000)
    ind=pg.eval_on_selector_all("[data-indicator]","e=>Object.fromEntries(e.map(r=>[r.dataset.indicator,r.cells[1].textContent]))")
    chk("Gráfico + 5 indicadores desde archivo GEANT4", len(ind)==5, ind); chk("f = 7/24 = 0.29167", ind["interaction_fraction"].startswith("0.2916"), ind["interaction_fraction"])
    chk("Eje X con unidades", "MeV" in pg.evaluate("document.getElementById('nrPlot').layout.xaxis.title.text"))
    # toggle estadísticas
    n_on=pg.evaluate("document.getElementById('nrPlot').layout.annotations.length"); pg.click("label[for=nrToggleStats]"); pg.wait_for_timeout(500)
    chk("Desactivar estadísticas oculta tabla y overlays, conserva datos y gráfico", pg.locator("[data-indicator]").count()==0 and pg.evaluate("document.getElementById('nrPlot').layout.annotations.length")==0 and pg.evaluate("document.getElementById('nrPlot').data[0].y.length")>0 and n_on>0)
    pg.click("label[for=nrToggleStats]"); pg.wait_for_timeout(500); chk("Reactivar restaura los 5 indicadores", pg.locator("[data-indicator]").count()==5)
    # B: demo
    pg.click("[data-source=demo]"); pg.fill("#demo_nEvents","30000"); pg.click("#demoRun"); pg.wait_for_selector(".nr-src-demo-simulation",timeout=10000); pg.wait_for_timeout(500)
    chk("Demo etiquetada como NO GEANT4", "NO es GEANT4" in pg.inner_text(".nr-src-demo-simulation") and "NO es una simulación GEANT4" in pg.inner_text("[data-testid=src-demo]"))
    f=float(pg.eval_on_selector("[data-indicator=interaction_fraction]","r=>r.cells[1].textContent")); exp=1-math.exp(-2*0.94*6.02214076e23/14.0266*2.6e-24*1.0)
    chk("Demo: f coincide con la probabilidad analítica del modelo", abs(f-exp)<0.012, (f,exp))
    # C: tabla manual
    pg.click("[data-source=manual]"); pg.wait_for_selector("#manApply")
    ins=pg.locator(".nr-edit input"); 
    for i,v in enumerate(["0","1.5","0","2.5","0.5"]): ins.nth(i).fill(v)
    pg.click("#manApply"); pg.wait_for_timeout(700)
    chk("Tabla manual genera gráfico (5 eventos, 3 con depósito)", "5 eventos" in pg.inner_text(".nr-info") and "3 con energía" in pg.inner_text(".nr-info"), pg.inner_text(".nr-info")[:160])
    pg.click("#manAdd"); chk("Añadir fila", pg.locator(".nr-edit tbody tr").count()==6)
    pg.click("button[aria-label='Eliminar fila 1']"); chk("Eliminar fila", pg.locator(".nr-edit tbody tr").count()==5)
    pg.locator(".nr-edit input").nth(0).fill("1,5"); pg.click("#manApply"); chk("Coma decimal rechazada con mensaje claro", "punto decimal" in pg.inner_text("[data-testid=src-manual] .nr-err"))
    chk("Fila inválida marcada en la tabla", pg.locator(".nr-edit input.bad").count()==1)
    pg.locator(".nr-edit input").nth(0).fill("-3"); pg.click("#manApply"); chk("Valor negativo rechazado", "negativ" in pg.inner_text("[data-testid=src-manual] .nr-err"))
    # --- IA
    pg.click(".nr-back"); pg.click("#modeAI"); pg.wait_for_selector(".nr-banner")
    chk("Sección IA con aviso 'IA NO conectada'", "IA NO conectada" in pg.inner_text(".nr-banner"))
    chk("IA reutiliza los mismos componentes (cargador GEANT4 y simulación)", pg.locator("[data-testid=src-geant4]").count()==1 and pg.locator("[data-testid=src-demo]").count()==1)
    pg.click("#demoRun"); pg.wait_for_selector("#nrPlot.js-plotly-plot",timeout=10000); pg.wait_for_timeout(600)
    chk("IA: mismo gráfico/indicadores del mismo motor", pg.locator("[data-indicator]").count()==5)
    ctx_txt=pg.inner_text(".nr-ctx"); chk("Contexto preparado: sin valores individuales", "NO incluidos" in ctx_txt and "Excluye" in ctx_txt)
    pg.fill("#aiInput","Quiero estudiar el espectro"); pg.click("#aiSend"); pg.wait_for_selector(".nr-msg.assistant",timeout=5000)
    chk("Conversación con Mock claramente identificado", "MOCK" in pg.inner_text(".nr-msg.assistant") and "Mock" in pg.inner_text(".nr-msg.assistant small"))
    pg.click("#aiClose"); pg.wait_for_timeout(300); chk("Cerrar conversación y recuperarla", pg.locator("#aiList option").count()>=2)
    pg.select_option("#aiList",index=1); pg.wait_for_timeout(300); chk("Recupera mensajes al reabrir", pg.locator(".nr-msg").count()==2)
    # --- regresión funciones previas
    pg.evaluate("go('files')"); pg.wait_for_selector("#files.on"); chk("File Explorer sigue accesible", pg.is_visible("#up"))
    pg.evaluate("go('home')"); chk("Rail lateral con entrada nueva", "Seleccionar archivo para analizar" in pg.inner_text("nav"))
    chk("Sin errores JS", not errs, errs[:3])
    b.close()
fails=[r[0] for r in res if not r[1]]; print("\nTOTAL",len(res),"FALLOS",len(fails),fails)
sys.exit(1 if fails else 0)
