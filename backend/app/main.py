from io import BytesIO
from uuid import uuid4
import json
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .config import settings
from .schemas import ProblemCreate, ResearchQuery, ComparisonCreate
from .services.analysis import analyze_frame
from .services.quantum import REGISTRY, recommend
from .services.research import search_literature
from .services.reports import build_pdf_report

app=FastAPI(title=settings.app_name,version="0.1.0",description="Scientific data analysis and quantum-method assessment API. Quantum algorithms are not executed by this version.")
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_origins,allow_credentials=False,allow_methods=["GET","POST","OPTIONS"],allow_headers=["*"])
PROBLEMS={}
COMPARISONS={}
ALLOWED={".csv",".tsv",".xlsx",".xls",".json"}

@app.get("/")
def root():
    return {"service":"Data Analyzer API","version":"0.1.0","docs":"/docs","health":"/health"}

@app.get("/health")
def health():
    return {"status":"ok","service":"data-analyzer-api","version":"0.1.0"}

@app.post(settings.api_prefix+"/files/analyze")
async def analyze_file(file: UploadFile=File(...)):
    name=(file.filename or "").lower()
    ext="."+name.rsplit(".",1)[-1] if "." in name else ""
    if ext not in ALLOWED:
        raise HTTPException(415,"Supported formats: CSV, TSV, XLSX, XLS and JSON.")
    content=await file.read(settings.max_upload_mb*1024*1024+1)
    if len(content)>settings.max_upload_mb*1024*1024:
        raise HTTPException(413,f"File exceeds the {settings.max_upload_mb} MB limit.")
    try:
        stream=BytesIO(content)
        if ext==".csv": frame=pd.read_csv(stream)
        elif ext==".tsv": frame=pd.read_csv(stream,sep="\\t")
        elif ext in {".xlsx",".xls"}: frame=pd.read_excel(stream)
        else:
            raw=json.loads(content.decode("utf-8-sig"))
            if isinstance(raw,list): frame=pd.DataFrame(raw)
            elif isinstance(raw,dict) and isinstance(raw.get("data"),list): frame=pd.DataFrame(raw["data"])
            else: raise ValueError("JSON must be an array of records or an object with a 'data' array.")
        if len(frame.columns)>500: raise ValueError("File contains too many columns (maximum 500).")
        result=analyze_frame(frame)
        return {"dataset_id":str(uuid4()),"filename":file.filename,"analysis":result,"limitations":["The uploaded file is processed in memory and is not persisted.","Statistical associations do not establish causality.","Outlier flags are exploratory and require domain review."]}
    except (ValueError,UnicodeDecodeError,json.JSONDecodeError) as exc:
        raise HTTPException(422,f"Could not interpret file: {exc}") from exc
    except Exception as exc:
        raise HTTPException(422,"File could not be parsed. Check its format and encoding.") from exc

@app.post(settings.api_prefix+"/problems")
def create_problem(problem: ProblemCreate):
    item=problem.model_dump()
    item["id"]=str(uuid4())
    item["status"]="draft"
    PROBLEMS[item["id"]]=item
    return item

@app.get(settings.api_prefix+"/problems/{problem_id}")
def get_problem(problem_id: str):
    if problem_id not in PROBLEMS: raise HTTPException(404,"Scientific problem not found.")
    return PROBLEMS[problem_id]

@app.get(settings.api_prefix+"/quantum/algorithms")
def algorithms():
    return {"algorithms":REGISTRY,"execution_available":False}

@app.post(settings.api_prefix+"/quantum/recommend")
def quantum_recommend(problem: ProblemCreate):
    return recommend(problem.model_dump())

@app.post(settings.api_prefix+"/research/search")
async def research(query: ResearchQuery):
    allowed={"openalex","crossref","arxiv"}
    if not set(query.sources)<=allowed: raise HTTPException(422,"Unknown research source.")
    return await search_literature(query.query,query.sources,query.limit)

@app.post(settings.api_prefix+"/comparisons")
def create_comparison(item: ComparisonCreate):
    record=item.model_dump()
    record["id"]=str(uuid4())
    record["status"]="awaiting_measured_results"
    record["warning"]="No classical or quantum execution is performed by this endpoint. Submit measured results from validated external runs."
    COMPARISONS[record["id"]]=record
    return record

@app.get(settings.api_prefix+"/comparisons/{comparison_id}")
def get_comparison(comparison_id: str):
    if comparison_id not in COMPARISONS: raise HTTPException(404,"Comparison not found.")
    return COMPARISONS[comparison_id]

@app.post(settings.api_prefix+"/reports/pdf")
def export_report(payload: dict):
    title=str(payload.get("title","Data Analyzer scientific report"))
    sections=payload.get("sections",[])
    if not isinstance(sections,list) or len(sections)>100: raise HTTPException(422,"sections must be a list with at most 100 entries.")
    data=build_pdf_report(title,sections)
    return StreamingResponse(BytesIO(data),media_type="application/pdf",headers={"Content-Disposition":'attachment; filename="data-analyzer-report.pdf"'})
