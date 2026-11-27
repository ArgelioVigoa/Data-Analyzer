/** Descriptive registry, not an executable quantum backend. */
export const algorithmRegistry=Object.freeze([
{id:"vqe",name:"Variational Quantum Eigensolver",tasks:["eigenvalue","ground-state"],status:"catalogue"},
{id:"qaoa",name:"Quantum Approximate Optimization Algorithm",tasks:["combinatorial-optimization"],status:"catalogue"},
{id:"qae",name:"Quantum Amplitude Estimation",tasks:["expectation","probability-estimation","monte-carlo"],status:"catalogue"},
{id:"grover",name:"Grover Search",tasks:["unstructured-search"],status:"catalogue"}
]);
export const getAlgorithm=id=>algorithmRegistry.find(a=>a.id===id)??null;
export const findAlgorithmsForTask=task=>algorithmRegistry.filter(a=>a.tasks.includes(task));
