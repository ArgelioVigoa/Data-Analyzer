"""Persistence for the AI-assisted analysis section (conversations) and analysis records.
Reuses the existing JWT auth (current_user), SQLAlchemy session and per-account isolation.
There is NO inference endpoint: no AI provider is connected in this stage, and provider credentials never pass through the API."""
import json
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ..auth import current_user
from ..config import settings
from ..database import get_db
from ..models import AIConversation, AnalysisRecord, User

router = APIRouter(prefix=settings.api_prefix)
MAX_MESSAGES, MAX_CONVERSATIONS, MAX_RECORDS, MAX_JSON_BYTES = 200, 200, 500, 200_000
FORBIDDEN_KEYS = {"edepmev", "values", "raw", "rows", "sample", "apikey", "api_key", "token", "secret", "password", "authorization"}

def _check_json(obj: Any, what: str):
    if len(json.dumps(obj, default=str)) > MAX_JSON_BYTES: raise ValueError(f"{what} supera {MAX_JSON_BYTES} bytes")
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if str(k).lower().replace("-", "_") in FORBIDDEN_KEYS: raise ValueError(f"{what} no puede contener «{k}» (datos crudos o credenciales)")
                walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(obj); return obj

class ConversationCreate(BaseModel):
    title: str = Field(default="Nueva conversación", min_length=1, max_length=120)
    dataset_ref: str | None = Field(default=None, max_length=64)

class MessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)
    meta: dict = Field(default_factory=dict)
    @field_validator("meta")
    @classmethod
    def small_meta(cls, v): return _check_json(v, "meta")

class RecordCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_type: Literal["geant4-file", "demo-simulation", "manual-table"]
    engine: str = Field(min_length=1, max_length=40)
    dataset_meta: dict
    result: dict
    @field_validator("dataset_meta", "result")
    @classmethod
    def no_raw(cls, v, info): return _check_json(v, info.field_name)

def _conv(c: AIConversation, full=True):
    d = {"id": c.id, "title": c.title, "dataset_ref": c.dataset_ref, "status": c.status, "created_at": c.created_at, "updated_at": c.updated_at, "n_messages": len(c.messages or [])}
    if full: d["messages"] = c.messages
    return d

def _own(db: Session, user: User, cid: str) -> AIConversation:
    c = db.get(AIConversation, cid)
    if not c or c.owner_id != user.id: raise HTTPException(404, "Conversation not found")   # same answer for foreign ids: no existence leak
    return c

@router.get("/ai/providers")
def providers():
    """Honest capability report. Only the browser-side test double exists; no real provider is connected."""
    return {"providers": [{"id": "mock", "label": "Mock (solo pruebas de arquitectura)", "is_mock": True, "transport": "browser"}], "real_providers_connected": [], "inference_available": False}

@router.post("/ai/conversations", status_code=201)
def create_conversation(payload: ConversationCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if db.scalar(select(func.count()).select_from(AIConversation).where(AIConversation.owner_id == user.id)) >= MAX_CONVERSATIONS: raise HTTPException(409, "Conversation limit reached")
    now = datetime.now(timezone.utc); c = AIConversation(id=str(uuid4()), owner_id=user.id, title=payload.title, dataset_ref=payload.dataset_ref, status="open", messages=[], created_at=now, updated_at=now)
    db.add(c); db.commit(); db.refresh(c); return _conv(c)

@router.get("/ai/conversations")
def list_conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(AIConversation).where(AIConversation.owner_id == user.id).order_by(AIConversation.updated_at.desc()).limit(MAX_CONVERSATIONS)).all()
    return [_conv(c, full=False) for c in rows]

@router.get("/ai/conversations/{cid}")
def get_conversation(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)): return _conv(_own(db, user, cid))

@router.post("/ai/conversations/{cid}/messages", status_code=201)
def add_message(cid: str, msg: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _own(db, user, cid)
    if c.status != "open": raise HTTPException(409, "Conversation is closed")
    if len(c.messages or []) >= MAX_MESSAGES: raise HTTPException(409, "Message limit reached")
    now = datetime.now(timezone.utc)
    c.messages = [*(c.messages or []), {"id": str(uuid4()), "role": msg.role, "content": msg.content, "meta": msg.meta, "at": now.isoformat()}]   # new list: JSON column change is detected
    c.updated_at = now; db.commit(); return {"n_messages": len(c.messages)}

@router.post("/ai/conversations/{cid}/close")
def close_conversation(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _own(db, user, cid); c.status = "closed"; c.updated_at = datetime.now(timezone.utc); db.commit(); return _conv(c, full=False)

@router.post("/ai/conversations/{cid}/reopen")
def reopen_conversation(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _own(db, user, cid); c.status = "open"; c.updated_at = datetime.now(timezone.utc); db.commit(); return _conv(c, full=False)

@router.delete("/ai/conversations/{cid}", status_code=204)
def delete_conversation(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, cid)); db.commit()

@router.post("/analysis-records", status_code=201)
def create_record(payload: RecordCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if db.scalar(select(func.count()).select_from(AnalysisRecord).where(AnalysisRecord.owner_id == user.id)) >= MAX_RECORDS: raise HTTPException(409, "Record limit reached")
    r = AnalysisRecord(id=str(uuid4()), owner_id=user.id, name=payload.name, source_type=payload.source_type, engine=payload.engine, dataset_meta=payload.dataset_meta, result=payload.result)
    db.add(r); db.commit(); return {"id": r.id}

@router.get("/analysis-records")
def list_records(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(AnalysisRecord).where(AnalysisRecord.owner_id == user.id).order_by(AnalysisRecord.created_at.desc()).limit(MAX_RECORDS)).all()
    return [{"id": r.id, "name": r.name, "source_type": r.source_type, "engine": r.engine, "created_at": r.created_at} for r in rows]

@router.get("/analysis-records/{rid}")
def get_record(rid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(AnalysisRecord, rid)
    if not r or r.owner_id != user.id: raise HTTPException(404, "Record not found")
    return {"id": r.id, "name": r.name, "source_type": r.source_type, "engine": r.engine, "dataset_meta": r.dataset_meta, "result": r.result, "created_at": r.created_at}
