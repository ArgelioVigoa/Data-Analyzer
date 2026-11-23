/** HTTP boundary for a future Python/Qiskit service; no service is presumed deployed. */
export class BackendClient{
 constructor({baseUrl=""}={}){this.baseUrl=baseUrl.replace(/\/$/,"")}
 get configured(){return Boolean(this.baseUrl)}
 async request(path,{method="GET",body,signal}={}){
  if(!this.configured)throw new Error("Quantum backend is not configured.");
  const response=await fetch(`${this.baseUrl}${path.startsWith("/")?path:`/${path}`}`,{method,signal,headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw new Error(`Backend request failed: HTTP ${response.status}`);
  return response.status===204?null:response.json();
 }
}
