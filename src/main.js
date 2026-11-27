import {dataStore} from "./core/data-store.js";
import {parseCSV,rowsToObjects} from "./io/csv.js";
import {describe} from "./analysis/statistics.js";
import {algorithmRegistry} from "./quantum/algorithm-registry.js";
import {BackendClient} from "./services/backend-client.js";
import {DataAnalyzerUI} from "./ui/analysis-ui.js";
import {dataSourceManager} from "./data/data-source-manager.js";
import {runAnalysis} from "./analysis/neutron-service.js";
import {AICore} from "./ai-core/index.js";
/* Extension bridge while legacy UI logic is migrated in tested increments. */
globalThis.DataAnalyzer=Object.freeze({dataStore,parseCSV,rowsToObjects,describe,algorithmRegistry,createBackendClient:options=>new BackendClient(options),dataSourceManager,runAnalysis,AICore});
globalThis.DataAnalyzerUI=DataAnalyzerUI;
/* Browser-like back/forward controls for the ecosystem's internal view history. */
const navBack=document.createElement("button");
navBack.type="button";navBack.id="navBack";navBack.className="nav-history";navBack.textContent="← Atrás";
navBack.setAttribute("aria-label","Volver a la vista anterior");navBack.title="Volver a la vista anterior";
navBack.addEventListener("click",()=>globalThis.AppNavigation?.back?.());
const navForward=document.createElement("button");
navForward.type="button";navForward.id="navForward";navForward.className="nav-history";
navForward.textContent="Adelante →";navForward.setAttribute("aria-label","Avanzar a la vista siguiente");
navForward.title="Avanzar a la vista siguiente";
navForward.addEventListener("click",()=>globalThis.AppNavigation?.forward?.());
const moduleSelect=document.querySelector(".module-jump-label");
document.querySelector(".bar")?.insertBefore(navBack,moduleSelect||null);
document.querySelector(".bar")?.insertBefore(navForward,moduleSelect||null);


document.documentElement.dataset.dataAnalyzerCore="loaded";
