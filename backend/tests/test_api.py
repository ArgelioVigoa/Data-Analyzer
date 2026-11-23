import uuid
from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
def account():
    email=f"{uuid.uuid4().hex}@example.org"
    assert client.post("/api/v1/auth/register",json={"email":email,"password":"correct-horse-battery-42"}).status_code==201
    token=client.post("/api/v1/auth/token",data={"username":email,"password":"correct-horse-battery-42"}).json()["access_token"]
    return {"Authorization":f"Bearer {token}"}
def test_health_and_algorithms():
    assert client.get("/health").status_code==200
    assert client.get("/api/v1/quantum/algorithms").json()["execution_available"] is False
def test_upload_persists_and_is_private():
    headers=account()
    csv=b"energy,counts"+bytes([10])+b"1,10"+bytes([10])+b"2,12"+bytes([10])+b"3,9"+bytes([10])
    response=client.post("/api/v1/files/analyze",headers=headers,files={"file":("measurements.csv",csv,"text/csv")})
    assert response.status_code==200
    body=response.json()
    assert body["analysis"]["shape"]=={"rows":3,"columns":2}
    assert client.get("/api/v1/datasets/"+body["dataset_id"],headers=headers).status_code==200
    assert client.get("/api/v1/datasets/"+body["dataset_id"]).status_code==401
def test_auth_and_upload_validation():
    assert client.post("/api/v1/files/analyze",files={"file":("a.png",b"bad","image/png")}).status_code==401
    assert client.post("/api/v1/auth/register",json={"email":"weak@example.org","password":"tiny"}).status_code==422
def test_problems_and_comparisons_require_ownership():
    headers=account()
    payload={"title":"Neutron transport","field":"Nuclear physics","objective":"Estimate transmission probability using Monte Carlo"}
    problem=client.post("/api/v1/problems",headers=headers,json=payload).json()
    comparison=client.post("/api/v1/comparisons",headers=headers,json={"problem_id":problem["id"],"classical_method":"Monte Carlo","quantum_method":"QAE"})
    assert comparison.status_code==200
    assert client.get("/api/v1/comparisons/"+comparison.json()["id"],headers=headers).status_code==200
