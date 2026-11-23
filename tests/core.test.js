import test from "node:test";import assert from "node:assert/strict";
import {parseCSV,rowsToObjects} from "../src/io/csv.js";
import {mean,variance,describe} from "../src/analysis/statistics.js";
import {DataStore} from "../src/core/data-store.js";import {getAlgorithm} from "../src/quantum/algorithm-registry.js";
test("CSV supports quoted delimiters and escaped quotes",()=>{assert.deepEqual(parseCSV('name,value\n"A, B","say ""hi"""'),[["name","value"],["A, B",'say "hi"']]);assert.deepEqual(rowsToObjects([["a"],["1"]]),[{a:"1"}])});
test("statistics ignore non-finite values",()=>{assert.equal(mean([1,2,3,Infinity]),2);assert.equal(variance([1,2,3]),1);assert.equal(describe([1,2,3]).median,2)});
test("transient store notifies and clears",()=>{const s=new DataStore();let n=0;s.subscribe(()=>n++);s.addDataset({name:"test"});s.clear();assert.equal(s.getState().datasets.length,0);assert.equal(n,2)});
test("QAE is listed as catalogue metadata",()=>assert.equal(getAlgorithm("qae").status,"catalogue"));
