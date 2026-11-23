from contextlib import asynccontextmanager
from io import BytesIO
from uuid import uuid4
import json
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import select
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from .config import settings
from .database import Base, engine, get_db
from .models import User, Dataset, ScientificProblem, Comparison
from .auth import hash_password, verify_password, create_access_token, current_user
from .schemas import RegisterRequest, TokenResponse, ProblemCreate, ResearchQuery, ComparisonCreate
from .services.analysis import analyze_frame
from .services.quantum import REGISTRY, recommend
from .services.research import search_literature
from .services.reports import build_pdf_report

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

limiter=Limiter(key_func=get_remote_address,default_limits=[settings.rate_limit])
app=FastAPI(title=settings.app_name,version="0.2.0",description="Scientific data API with persistent storage and per-account isolation. Quantum execution is not included.",lifespan=lifespan)
app.state.limiter=limiter
app.add_exception_handler(RateLimitExceeded,_rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_origins,allow_credentials=False,allow_methods=["GET","POST","OPTIONS"],allow_headers=["Authorization","Content-Type"])
app.add_middleware(TrustedHostMiddleware,allowed_hosts=settings.host_names)

@app.middleware("http")
async def security_headers(request: Request,call_next):
    response=await call_next(request)
    response.headers["X-Content-Type-Options"]="nosniff"
    response.headers["X-Frame-Options"]="DENY"
    response.headers["Referrer-Policy"]="strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]="camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"]="no-store" if request.url.path.startswith(settings.api_prefix) else "no-cache"
    return response

@app.get("/")
def root():
    return {"service":"Data Analyzer API","version":"0.2.0","docs":"/docs","health":"/health"}

@app.get("/health")
def health(db:Session=Depends(get_db)):
    db.execute(select(1))
    return {"status":"ok","database":"connected","service":"data-analyzer-api","version":"0.2.0"}

@app.post(settings.api_prefix+"/auth/register",status_code=201)
@limiter.limit("5/hour")
def register(request:Request,payload:RegisterRequest,db:Session=Depends(get_db)):
    email=str(payload.email).lower()
    if db.scalar(select(User).where(User.email==email)):
        raise HTTPException(409,"An account with this email already exists.")
    user=User(email=email,password_hash=hash_password(payload.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"id":user.id,"email":user.email,"message":"Account created. Sign in to obtain an access token."}

@app.post(settings.api_prefix+"/auth/token",response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request:Request,form:OAuth2PasswordRequestForm=Depends(),db:Session=Depends(get_db)):
    user=db.scalar(select(User).where(User.email==form.username.lower()))
    if not user or not verify_password(form.password,user.password_hash):
        raise HTTPException(401,"Incorrect email or password.",headers={"WWW-Authenticate":"Bearer"})
    return {"access_token":create_access_token(user.id),"token_type":"bearer","expires_in":settings.access_token_minutes*60}

ALLOWED={".csv",".tsv",".xlsx",".xls",".json"}
@app.post(settings.api_prefix+"/files/analyze")
@limiter.limit("10/hour")
async def analyze_file(request:Request,file:UploadFile=File(...),user:User=Depends(current_user),db:Session=Depends(get_db)):
    name=(file.filename or "dataset").replace("\\","/").split("/")[-1][:255]
    ext="."+name.lower().rsplit(".",1)[-1] if "." in name else ""
    if ext not in ALLOWED: raise HTTPException(415,"Supported formats: CSV, TSV, XLSX, XLS and JSON.")
    content=await file.read(settings.max_upload_mb*1024*1024+1); await file.close()
    if len(content)>settings.max_upload_mb*1024*1024: raise HTTPException(413,f"File exceeds the {settings.max_upload_mb} MB limit.")
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
        if len(frame.columns)>500 or len(frame)>1_000_000: raise ValueError("Dataset exceeds the maximum of 500 columns or 1,000,000 rows.")
        result=analyze_frame(frame); dataset_id=str(uuid4())
        db.add(Dataset(id=dataset_id,owner_id=user.id,filename=name,analysis=result)); db.commit()
        return {"dataset_id":dataset_id,"filename":name,"analysis":result,"limitations":["The original uploaded file is not retained; analysis results and metadata are persisted.","Statistical associations do not establish causality.","Outlier flags are exploratory and require domain review."]}
    except HTTPException: raise
    except (ValueError,UnicodeDecodeError,json.JSONDecodeError) as exc:
        raise HTTPException(422,f"Could not interpret file: {exc}") from exc
    except Exception as exc:
        db.rollback(); raise HTTPException(422,"File could not be parsed. Check its format and encoding.") from exc

@app.get(settings.api_prefix+"/datasets")
def list_datasets(user:User=Depends(current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(Dataset).where(Dataset.owner_id==user.id).order_by(Dataset.created_at.desc()).limit(100)).all()
    return [{"id":x.id,"filename":x.filename,"created_at":x.created_at.isoformat()} for x in rows]
@app.get(settings.api_prefix+"/datasets/{dataset_id}")
def get_dataset(dataset_id:str,user:User=Depends(current_user),db:Session=Depends(get_db)):
    x=db.scalar(select(Dataset).where(Dataset.id==dataset_id,Dataset.owner_id==user.id))
    if not x: raise HTTPException(404,"Dataset not found.")
    return {"id":x.id,"filename":x.filename,"analysis":x.analysis,"created_at":x.created_at.isoformat()}

@app.post(settings.api_prefix+"/problems")
def create_problem(problem:ProblemCreate,user:User=Depends(current_user),db:Session=Depends(get_db)):
    item=problem.model_dump()
    if item["dataset_id"] and not db.scalar(select(Dataset).where(Dataset.id==item["dataset_id"],Dataset.owner_id==user.id)):
        raise HTTPException(404,"Dataset not found for this account.")
    item.update({"id":str(uuid4()),"status":"draft"})
    db.add(ScientificProblem(id=item["id"],owner_id=user.id,data=item)); db.commit()
    return item
@app.get(settings.api_prefix+"/problems")
def list_problems(user:User=Depends(current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(ScientificProblem).where(ScientificProblem.owner_id==user.id).order_by(ScientificProblem.created_at.desc()).limit(100)).all()
    return [x.data for x in rows]
@app.get(settings.api_prefix+"/problems/{problem_id}")
def get_problem(problem_id:str,user:User=Depends(current_user),db:Session=Depends(get_db)):
    x=db.scalar(select(ScientificProblem).where(ScientificProblem.id==problem_id,ScientificProblem.owner_id==user.id))
    if not x: raise HTTPException(404,"Scientific problem not found.")
    return x.data

@app.get(settings.api_prefix+"/quantum/algorithms")
def algorithms():
    return {"algorithms":REGISTRY,"execution_available":False}
@app.post(settings.api_prefix+"/quantum/recommend")
def quantum_recommend(problem:ProblemCreate,user:User=Depends(current_user)):
    return recommend(problem.model_dump())
@app.post(settings.api_prefix+"/research/search")
@limiter.limit("10/minute")
async def research(request:Request,query:ResearchQuery,user:User=Depends(current_user)):
    if not set(query.sources)<={"openalex","crossref","arxiv"}: raise HTTPException(422,"Unknown research source.")
    return await search_literature(query.query,query.sources,query.limit)

@app.post(settings.api_prefix+"/comparisons")
def create_comparison(item:ComparisonCreate,user:User=Depends(current_user),db:Session=Depends(get_db)):
    problem=db.scalar(select(ScientificProblem).where(ScientificProblem.id==item.problem_id,ScientificProblem.owner_id==user.id))
    if not problem: raise HTTPException(404,"Scientific problem not found for this account.")
    record=item.model_dump()
    record.update({"id":str(uuid4()),"status":"awaiting_measured_results","warning":"No classical or quantum execution is performed by this endpoint. Submit measured results from validated external runs."})
    db.add(Comparison(id=record["id"],owner_id=user.id,data=record)); db.commit()
    return record
@app.get(settings.api_prefix+"/comparisons")
def list_comparisons(user:User=Depends(current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(Comparison).where(Comparison.owner_id==user.id).order_by(Comparison.created_at.desc()).limit(100)).all()
    return [x.data for x in rows]
@app.get(settings.api_prefix+"/comparisons/{comparison_id}")
def get_comparison(comparison_id:str,user:User=Depends(current_user),db:Session=Depends(get_db)):
    x=db.scalar(select(Comparison).where(Comparison.id==comparison_id,Comparison.owner_id==user.id))
    if not x: raise HTTPException(404,"Comparison not found.")
    return x.data

@app.post(settings.api_prefix+"/reports/pdf")
def export_report(payload:dict,user:User=Depends(current_user)):
    title=str(payload.get("title","Data Analyzer scientific report"))
    sections=payload.get("sections",[])
    if not isinstance(sections,list) or len(sections)>100: raise HTTPException(422,"sections must be a list with at most 100 entries.")
    data=build_pdf_report(title,sections)
    return StreamingResponse(BytesIO(data),media_type="application/pdf",headers={"Content-Disposition":'attachment; filename="data-analyzer-report.pdf"'})
