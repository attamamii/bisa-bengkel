"""Uji alur end-to-end API BISA (25 pemeriksaan).

Jalankan dari folder mana pun:
    python tests/smoke.py
"""

import json
import os
import sys
from pathlib import Path

# Agar `app` bisa diimpor walau skrip dijalankan dari dalam folder tests.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["DB_ENGINE"] = "sqlite"
os.environ["AUTO_SEED"] = "true"

from app import create_app  # noqa: E402

app = create_app()
app.config["TESTING"] = True
client = app.test_client()


def call(method, path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = getattr(client, method)(path, headers=headers, **kw)
    try:
        body = resp.get_json()
    except Exception:
        body = resp.data[:200]
    return resp.status_code, body


def login(email, password):
    code, body = call("post", "/api/auth/login", json={"email": email, "password": password})
    assert code == 200, (email, code, body)
    return body["token"]


failures = []


def check(name, condition, detail=""):
    print(("PASS " if condition else "FAIL ") + name + ("" if condition else f" -> {detail}"))
    if not condition:
        failures.append(name)


admin = login("admin@bisa.id", "Admin#123")
mekanik = login("andi@bisa.id", "Mekanik#123")
customer = login("budi@bisa.id", "Customer#123")

check("login 3 role", all([admin, mekanik, customer]))

code, body = call("get", "/api/admin/dashboard?period=month", admin)
check("dashboard admin", code == 200, body)
if code == 200:
    check("dashboard punya revenue", "revenue" in body["stats"], body)

code, body = call("get", "/api/admin/parts", admin)
check("list parts", code == 200 and len(body["parts"]) > 10, body if code != 200 else len(body["parts"]))

code, body = call("get", "/api/workshop/board", mekanik)
check("board mekanik", code == 200, body)
if code == 200:
    check("board punya bucket", set(body["buckets"]) == {"menunggu", "dikerjakan", "selesai_pengerjaan"}, body["buckets"])

code, body = call("get", "/api/customer/vehicles", customer)
check("list kendaraan", code == 200 and len(body["vehicles"]) == 1, body)
vehicle_id = body["vehicles"][0]["id"]

code, body = call(
    "post",
    "/api/customer/analyze",
    customer,
    json={"complaint": "Rem depan bunyi berdecit dan pedal blong", "vehicle_id": vehicle_id},
)
check("analisis AI", code == 200 and body["result"]["damages"], body)
analysis = body["result"]
check("estimasi > 0", analysis["estimate_min"] > 0 and analysis["estimate_max"] > analysis["estimate_min"], analysis)
analysis_id = analysis["analysis_id"]

code, body = call(
    "post",
    "/api/customer/analyze",
    customer,
    json={"complaint": "mobil saya rusak", "vehicle_id": vehicle_id},
)
check("fallback analisis", code == 200 and body["result"]["fallback"], body)

code, body = call("post", "/api/customer/analyze", customer, json={"complaint": "   "})
check("validasi keluhan kosong", code == 400, body)

code, body = call(
    "post",
    "/api/tickets",
    customer,
    json={
        "vehicle_id": vehicle_id,
        "complaint": "Rem depan bunyi berdecit dan pedal blong",
        "items": analysis["items"],
        "estimate_min": analysis["estimate_min"],
        "estimate_max": analysis["estimate_max"],
    },
)
check("buat tiket", code == 201, body)
ticket_id = body["ticket"]["id"]
ticket_code = body["ticket"]["code"]

code, body = call("post", f"/api/workshop/tickets/{ticket_id}/claim", mekanik)
check("klaim tiket", code == 200 and body["ticket"]["status"] == "dikerjakan", body)

code, body = call("get", "/api/workshop/catalog/parts?q=kampas", mekanik)
check("cari sparepart", code == 200 and body["parts"], body)
part_id = body["parts"][0]["id"]

code, body = call(
    "post",
    f"/api/workshop/tickets/{ticket_id}/items",
    mekanik,
    json={"kind": "part", "part_id": part_id, "qty": 1, "reason": "Kampas aus tidak rata"},
)
check("ajukan item tambahan", code == 201 and body["ticket"]["pending_count"] == 1, body)

code, body = call("get", f"/api/tickets/{ticket_id}", customer)
pending = [i for i in body["ticket"]["items"] if i["approval_status"] == "pending"]
check("customer melihat item pending", code == 200 and pending, body)
item_id = pending[0]["id"]

code, body = call("post", f"/api/tickets/{ticket_id}/decision", customer, json={"item_id": item_id, "decision": "approved"})
check("customer approve", code == 200 and body["ticket"]["pending_count"] == 0, body)

code, body = call("post", f"/api/workshop/tickets/{ticket_id}/finish", mekanik)
check("selesai pengerjaan", code == 200 and body["ticket"]["status"] == "selesai_pengerjaan", body)

code, body = call("post", f"/api/admin/cashier/{ticket_id}/pay", admin, json={"method": "tunai"})
check("bayar tiket", code == 200 and body["ticket"]["status"] == "selesai", body)

code, body = call("get", f"/api/tickets/{ticket_id}/nota", customer)
check("nota digital", code == 200 and body["nota"]["invoice_number"], body)

code, body = call("get", "/api/customer/analyses", customer)
check("riwayat analisis", code == 200 and len(body["analyses"]) >= 2, body)

code, body = call("get", "/api/tickets", customer)
check("list tiket customer", code == 200 and all(t["customer"]["id"] for t in body["tickets"]), body)

# Akses lintas peran harus ditolak.
code, _ = call("get", "/api/admin/parts", customer)
check("customer ditolak di endpoint admin", code == 403)

code, _ = call("get", "/api/workshop/board", customer)
check("customer ditolak di board mekanik", code == 403)

# Stok berkurang setelah pembayaran.
code, body = call("get", "/api/admin/parts?q=Kampas Rem Depan", admin)
check("stok terpotong", code == 200 and body["parts"][0]["stock"] < 20, body)

print()
print("TICKET", ticket_code, "items:", len(analysis["items"]))
print("FAILURES:", failures if failures else "none")
sys.exit(1 if failures else 0)
