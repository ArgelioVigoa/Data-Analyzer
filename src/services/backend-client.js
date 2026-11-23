/** HTTP adapter for the Python API. Never embed server secrets in this browser-side client. */
export class BackendClient{
 constructor({baseUrl="",accessToken=""}={}){this.baseUrl=baseUrl.replace(/\/$/,"");this.accessToken=accessToken}
 get configured(){return Boolean(this.baseUrl)}
 setAccessToken(token){this.accessToken=token||""}
 clearAccessToken(){this.accessToken=""}
 async request(path,{method="GET",body,signal,headers={},responseType="json",auth=true}={}){
  if(!this.configured)throw new Error("Data Analyzer API is not configured.");
  const isForm=typeof FormData!=="undefined"&&body instanceof FormData;
  const requestHeaders={...headers};
  if(auth&&this.accessToken)requestHeaders.Authorization=`Bearer ${this.accessToken}`;
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
 async register(email,password,{signal}={}){
  return this.request("/api/v1/auth/register",{method:"POST",body:{email,password},signal,auth:false});
 }
 async login(email,password,{signal}={}){
  const form=new URLSearchParams({username:email,password});
  const result=await this.request("/api/v1/auth/token",{method:"POST",body:form,headers:{"Content-Type":"application/x-www-form-urlencoded"},signal,auth:false});
  this.setAccessToken(result.access_token);
  return result;
 }
 analyzeFile(file,{signal}={}){
  const form=new FormData();form.append("file",file);
  return this.request("/api/v1/files/analyze",{method:"POST",body:form,signal});
 }
 listDatasets({signal}={}){return this.request("/api/v1/datasets",{signal})}
 getDataset(id,{signal}={}){return this.request(`/api/v1/datasets/${encodeURIComponent(id)}`,{signal})}
 createScientificProblem(problem,{signal}={}){
  return this.request("/api/v1/problems",{method:"POST",body:problem,signal});
 }
 listScientificProblems({signal}={}){return this.request("/api/v1/problems",{signal})}
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
