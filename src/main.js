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
/* Persistent shortcut: return to the Data Analyzer entry from any ecosystem module. */
const backToAnalyzer=document.createElement("button");
backToAnalyzer.type="button";
backToAnalyzer.id="backAnalyzer";
backToAnalyzer.className="back-analyzer";
backToAnalyzer.textContent="← Data Analyzer";
backToAnalyzer.setAttribute("aria-label","Volver al Analizador de datos");
backToAnalyzer.addEventListener("click",()=>{if(typeof globalThis.go==="function")globalThis.go("analysis");});
document.querySelector(".bar")?.insertBefore(backToAnalyzer,document.querySelector(".module-jump-label")||null);

document.documentElement.dataset.dataAnalyzerCore="loaded";
