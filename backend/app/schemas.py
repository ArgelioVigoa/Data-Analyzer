from pydantic import BaseModel, Field, EmailStr
from typing import Any
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
class ProblemCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    field: str = Field(min_length=2, max_length=120)
    objective: str = Field(min_length=5, max_length=2000)
    variables: list[dict[str, Any]] = Field(default_factory=list)
    units: dict[str, str] = Field(default_factory=dict)
    assumptions: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    hypotheses: list[str] = Field(default_factory=list)
    dataset_id: str | None = None
class ResearchQuery(BaseModel):
    query: str = Field(min_length=3, max_length=500)
    sources: list[str] = Field(default_factory=lambda: ["openalex", "crossref", "arxiv"])
    limit: int = Field(default=10, ge=1, le=30)
class ComparisonCreate(BaseModel):
    problem_id: str
    classical_method: str = Field(min_length=2, max_length=120)
    quantum_method: str = Field(min_length=2, max_length=120)
    metrics: list[str] = Field(default_factory=lambda: ["accuracy", "runtime", "memory", "query_complexity"])
    classical_results: dict[str, Any] = Field(default_factory=dict)
    quantum_results: dict[str, Any] = Field(default_factory=dict)
