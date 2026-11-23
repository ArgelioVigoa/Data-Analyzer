/** Temporary in-memory dataset store; persistence is deliberately adapter-based. */
export class DataStore {
 #state={datasets:[],activeDatasetId:null}; #listeners=new Set();
 getState(){return structuredClone(this.#state)}
 subscribe(fn){this.#listeners.add(fn);return()=>this.#listeners.delete(fn)}
 setState(next){this.#state=structuredClone(typeof next==="function"?next(this.getState()):next);for(const fn of this.#listeners)fn(this.getState())}
 addDataset(dataset){const id=dataset.id??(crypto.randomUUID?.()??`dataset-${Date.now()}`);this.setState(s=>({...s,datasets:[...s.datasets,{...dataset,id}],activeDatasetId:id}));return id}
 clear(){this.setState({datasets:[],activeDatasetId:null})}
}
export const dataStore=new DataStore();
