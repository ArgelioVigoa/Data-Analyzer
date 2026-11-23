import {dataStore} from "./core/data-store.js";
import {parseCSV,rowsToObjects} from "./io/csv.js";
import {describe} from "./analysis/statistics.js";
import {algorithmRegistry} from "./quantum/algorithm-registry.js";
import {BackendClient} from "./services/backend-client.js";
/* Extension bridge while legacy UI logic is migrated in tested increments. */
globalThis.DataAnalyzer=Object.freeze({dataStore,parseCSV,rowsToObjects,describe,algorithmRegistry,createBackendClient:options=>new BackendClient(options)});
document.documentElement.dataset.dataAnalyzerCore="loaded";
