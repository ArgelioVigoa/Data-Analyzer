/** HTTP adapter for the Python API. Keep secrets out of this browser-side client. */
export class BackendClient{
 constructor({baseUrl=""}={}){this.baseUrl=baseUrl.replace(/\/$/,"")}
 get configured(){return Boolean(this.baseUrl)}
 async request(path,{method="GET",body,signal,headers={},responseType="json"}={}){
  if(!this.configured)throw new Error("Data Analyzer API is not configured.");
  const isForm=typeof FormData!=="undefined"&&body instanceof FormData;
  const requestHeaders={...headers};
  if(body!==undefined&&!isForm&&!(body instanceof Blob))requestHeaders["Content-Type"]??="application/json";
  const response=await fetch(`${this.baseUrl}${path.startsWith("/")?path:`/${path}`}`,{
   method,signal,headers:requestHeaders,
   body:body===undefined?undefined:isForm||body instanceof Blob?body:JSON.stringify(body)
  });
  if(!response.ok){
   let detail=`HTTP ${response.status}`;
   try{const payload=await response.json();detail=payload.detail??payload.message??detail}catch{}
   throw new Error(`Data Analyzer API error: ${detail}`);
  }
  if(response.status===204)return null;
  if(responseType==="blob")return response.blob();
  if(responseType==="text")return response.text();
  return response.json();
 }
 analyzeFile(file,{signal}={}){
  const form=new FormData();form.append("file",file);
  return this.request("/api/v1/files/analyze",{method:"POST",body:form,signal});
 }
 createScientificProblem(problem,{signal}={}){
  return this.request("/api/v1/problems",{method:"POST",body:problem,signal});
 }
 recommendQuantumMethods(problem,{signal}={}){
  return this.request("/api/v1/quantum/recommend",{method:"POST",body:problem,signal});
 }
 searchLiterature(query,{sources,limit=10,signal}={}){
  return this.request("/api/v1/research/search",{method:"POST",body:{query,sources,limit},signal});
 }
 exportPdf(report,{signal}={}){
  return this.request("/api/v1/reports/pdf",{method:"POST",body:report,signal,responseType:"blob"});
 }
}
