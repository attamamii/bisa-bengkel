import json
import os

os.environ["DB_ENGINE"] = "sqlite"
os.environ["AUTO_SEED"] = "true"

from app import create_app  # noqa: E402

app = create_app()
app.config["TESTING"] = True
client = app.test_client()

def login(email, pw):
    r = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.get_json()
    return r.get_json()["token"]

def call(path, token):
    return client.get(path, headers={"Authorization": f"Bearer {token}"})

admin = login("admin@bisa.id", "Admin#123")
cust = login("budi@bisa.id", "Customer#123")
mech = login("andi@bisa.id", "Mekanik#123")

r = call("/api/notifications", cust)
print("notif customer:", r.status_code, "events:", len(r.get_json()["events"]), "pending:", r.get_json()["pending_count"])

r = call("/api/notifications?after=999999", admin)
print("notif after-high:", r.status_code, r.get_json()["events"], "cursor:", r.get_json()["cursor"], "latest:", r.get_json()["latest_id"])

r = call("/api/notifications", mech)
print("notif mekanik:", r.status_code, "events:", len(r.get_json()["events"]))

r = client.get("/api/openapi.json")
spec = r.get_json()
print("openapi:", r.status_code, "paths:", len(spec["paths"]), "ops:", sum(len(v) for v in spec["paths"].values()))
print("contoh path:", list(spec["paths"].keys())[:5])

r = client.get("/api/docs")
print("docs html:", r.status_code, b"swagger-ui" in r.data)

for t in (admin, cust):
    r = call("/api/admin/dashboard/export.csv?period=month", t)
    print("csv:", r.status_code, r.headers.get("Content-Type"), r.data[:60])
