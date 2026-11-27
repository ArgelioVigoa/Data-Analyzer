import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
Base.metadata.create_all(bind=engine)
client = TestClient(app)
P = "/api/v1"
def account():
    email = f"{uuid.uuid4().hex}@example.org"
    assert client.post(P + "/auth/register", json={"email": email, "password": "correct-horse-battery-42"}).status_code == 201
    token = client.post(P + "/auth/token", data={"username": email, "password": "correct-horse-battery-42"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_providers_report_is_honest_and_public_of_secrets():
    r = client.get(P + "/ai/providers").json()
    assert r["inference_available"] is False and r["real_providers_connected"] == []
    assert [p["id"] for p in r["providers"]] == ["mock"] and r["providers"][0]["is_mock"] is True
    assert "key" not in str(r).lower()

def test_conversation_lifecycle_and_persistence():
    h = account(); c = client.post(P + "/ai/conversations", headers=h, json={"title": "Espectro", "dataset_ref": "ds-1"}); assert c.status_code == 201
    cid = c.json()["id"]
    assert client.post(f"{P}/ai/conversations/{cid}/messages", headers=h, json={"role": "user", "content": "hola"}).json()["n_messages"] == 1
    assert client.post(f"{P}/ai/conversations/{cid}/messages", headers=h, json={"role": "assistant", "content": "[MOCK]", "meta": {"isMock": True}}).json()["n_messages"] == 2
    got = client.get(f"{P}/ai/conversations/{cid}", headers=h).json(); assert [m["role"] for m in got["messages"]] == ["user", "assistant"] and got["messages"][1]["meta"]["isMock"] is True
    assert client.post(f"{P}/ai/conversations/{cid}/close", headers=h).json()["status"] == "closed"
    assert client.post(f"{P}/ai/conversations/{cid}/messages", headers=h, json={"role": "user", "content": "x"}).status_code == 409
    assert client.post(f"{P}/ai/conversations/{cid}/reopen", headers=h).json()["status"] == "open"
    assert client.post(f"{P}/ai/conversations/{cid}/messages", headers=h, json={"role": "user", "content": "otra"}).status_code == 201
    assert [x["id"] for x in client.get(P + "/ai/conversations", headers=h).json()] == [cid]
    assert client.delete(f"{P}/ai/conversations/{cid}", headers=h).status_code == 204 and client.get(f"{P}/ai/conversations/{cid}", headers=h).status_code == 404

def test_accounts_are_isolated_and_unauthenticated_requests_rejected():
    a, b = account(), account(); cid = client.post(P + "/ai/conversations", headers=a, json={"title": "privada"}).json()["id"]
    for method, url, kw in [("get", f"/ai/conversations/{cid}", {}), ("post", f"/ai/conversations/{cid}/messages", {"json": {"role": "user", "content": "x"}}), ("post", f"/ai/conversations/{cid}/close", {}), ("delete", f"/ai/conversations/{cid}", {})]:
        assert getattr(client, method)(P + url, headers=b, **kw).status_code == 404, url          # same answer as a missing id: no existence leak
        assert getattr(client, method)(P + url, **kw).status_code == 401, url
    assert client.get(P + "/ai/conversations", headers=b).json() == []
    assert client.get(P + "/analysis-records").status_code == 401

def test_message_validation_limits():
    h = account(); cid = client.post(P + "/ai/conversations", headers=h, json={}).json()["id"]; u = f"{P}/ai/conversations/{cid}/messages"
    assert client.post(u, headers=h, json={"role": "system", "content": "x"}).status_code == 422
    assert client.post(u, headers=h, json={"role": "user", "content": ""}).status_code == 422
    assert client.post(u, headers=h, json={"role": "user", "content": "x" * 8001}).status_code == 422
    assert client.post(u, headers=h, json={"role": "user", "content": "x", "meta": {"apiKey": "abc"}}).status_code == 422
    assert client.post(P + "/ai/conversations", headers=h, json={"title": "t" * 121}).status_code == 422

def test_message_cap_per_conversation():
    h = account(); cid = client.post(P + "/ai/conversations", headers=h, json={}).json()["id"]; u = f"{P}/ai/conversations/{cid}/messages"
    for i in range(200): assert client.post(u, headers=h, json={"role": "user", "content": str(i)}).status_code == 201
    assert client.post(u, headers=h, json={"role": "user", "content": "extra"}).status_code == 409

REC = {"name": "demo", "source_type": "demo-simulation", "engine": "neutron-engine/1", "dataset_meta": {"nEvents": 1000, "provenance": {"modelId": "neutron-np-single-scatter/1"}}, "result": {"indicators": [{"id": "interaction_fraction", "value": 0.18}]}}
def test_analysis_record_roundtrip_private_and_without_raw_data():
    a, b = account(), account(); rid = client.post(P + "/analysis-records", headers=a, json=REC).json()["id"]
    assert client.get(f"{P}/analysis-records/{rid}", headers=a).json()["result"]["indicators"][0]["value"] == 0.18
    assert client.get(f"{P}/analysis-records/{rid}", headers=b).status_code == 404 and client.get(P + "/analysis-records", headers=b).json() == []
    assert client.post(P + "/analysis-records", headers=a, json={**REC, "dataset_meta": {"edepMeV": [1, 2, 3]}}).status_code == 422       # raw values refused
    assert client.post(P + "/analysis-records", headers=a, json={**REC, "result": {"x": "y" * 300000}}).status_code == 422                # size cap
    assert client.post(P + "/analysis-records", headers=a, json={**REC, "source_type": "ROOT"}).status_code == 422

def test_rate_limit_still_enforced_when_enabled():
    lim = app.state.limiter; lim.enabled = True; lim.reset()
    try:
        codes = [client.post(P + "/auth/register", json={"email": f"{uuid.uuid4().hex}@example.org", "password": "correct-horse-battery-42"}).status_code for _ in range(7)]
        assert codes[:5] == [201] * 5 and codes[5] == 429, codes          # "5/hour" on registration
    finally:
        lim.reset(); lim.enabled = False
