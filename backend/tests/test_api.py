from fastapi.testclient import TestClient
from app.main import app

client=TestClient(app)

def test_health_and_algorithm_registry():
    assert client.get("/health").status_code==200
    response=client.get("/api/v1/quantum/algorithms")
    assert response.status_code==200
    assert response.json()["execution_available"] is False

def test_csv_upload_returns_inspection_and_limits():
    response=client.post("/api/v1/files/analyze",files={"file":("measurements.csv",b"energy,counts\\n1.0,10\\n2.0,12\\n3.0,9\\n","text/csv")})
    assert response.status_code==200
    body=response.json()
    assert body["analysis"]["shape"]=={"rows":3,"columns":2}
    assert body["analysis"]["columns"][0]["statistics"]["mean"]==2.0
    assert body["dataset_id"]

def test_reject_unsupported_upload():
    response=client.post("/api/v1/files/analyze",files={"file":("image.png",b"not a data file","image/png")})
    assert response.status_code==415

def test_problem_creation_and_quantum_candidate_endpoint():
    payload={"title":"Neutron transport","field":"Nuclear physics","objective":"Estimate transmission probability using Monte Carlo","variables":[]}
    created=client.post("/api/v1/problems",json=payload)
    assert created.status_code==200
    assert created.json()["status"]=="draft"
    recommendation=client.post("/api/v1/quantum/recommend",json=payload)
    assert recommendation.status_code==200
    assert recommendation.json()["recommendations"][0]["id"]=="qae"
