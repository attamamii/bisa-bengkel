"""Endpoint sisi Customer: kendaraan, analisis AI, riwayat analisis."""

import json

from flask import Blueprint, g, jsonify

from ..ai.catalog import MANUAL_OPTIONS
from ..ai.engine import analyze
from ..extensions import db
from ..models import (
    APPROVAL_PENDING,
    AiAnalysis,
    ROLE_CUSTOMER,
    STATUS_SELESAI,
    Ticket,
    Vehicle,
    money,
)
from ..security import ApiError, roles_required
from ..utils import as_int, clean, json_body, require

bp = Blueprint("customer", __name__, url_prefix="/api/customer")


@bp.get("/vehicles")
@roles_required(ROLE_CUSTOMER)
def list_vehicles():
    vehicles = (
        Vehicle.query.filter_by(user_id=g.current_user.id)
        .order_by(Vehicle.created_at.desc())
        .all()
    )
    return jsonify({"vehicles": [v.to_dict() for v in vehicles]})


@bp.post("/vehicles")
@roles_required(ROLE_CUSTOMER)
def create_vehicle():
    data = json_body()
    require(data, [("plate_number", "Plat nomor")])

    plate = clean(data["plate_number"]).upper()
    if len(plate) < 4:
        raise ApiError(
            "Plat nomor tidak valid.",
            400,
            {"plate_number": "Contoh format: DD 1234 AB."},
        )

    vehicle = Vehicle(
        user_id=g.current_user.id,
        plate_number=plate[:16],
        brand=clean(data.get("brand"))[:60] or None,
        model=clean(data.get("model"))[:80] or None,
        year=as_int(data["year"], "Tahun") if data.get("year") else None,
    )
    db.session.add(vehicle)
    db.session.commit()
    return jsonify({"message": "Kendaraan berhasil ditambahkan.", "vehicle": vehicle.to_dict()}), 201


@bp.delete("/vehicles/<int:vehicle_id>")
@roles_required(ROLE_CUSTOMER)
def delete_vehicle(vehicle_id: int):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle or vehicle.user_id != g.current_user.id:
        raise ApiError("Kendaraan tidak ditemukan.", 404)
    if vehicle.tickets:
        raise ApiError("Kendaraan sudah memiliki riwayat servis dan tidak bisa dihapus.", 409)
    db.session.delete(vehicle)
    db.session.commit()
    return jsonify({"message": "Kendaraan dihapus."})


@bp.get("/damage-options")
@roles_required(ROLE_CUSTOMER)
def damage_options():
    """Opsi 'pilih manual' ketika AI tidak mengenali keluhan (UC-04)."""
    return jsonify({"options": MANUAL_OPTIONS})


@bp.post("/analyze")
@roles_required(ROLE_CUSTOMER)
def analyze_complaint():
    """UC-04 + UC-05: analisis keluhan dan tampilkan estimasi biaya."""
    data = json_body()
    complaint = clean(data.get("complaint"))
    manual_code = clean(data.get("manual_code")).upper() or None

    if not complaint and not manual_code:
        raise ApiError(
            "Harap ketikkan detail keluhan kendaraan Anda.",
            400,
            {"complaint": "Keluhan tidak boleh kosong."},
        )
    if len(complaint) > 1000:
        raise ApiError("Keluhan terlalu panjang (maksimal 1000 karakter).", 400)

    if manual_code:
        result = analyze(complaint or f"Pilih manual: {manual_code}", manual_code=manual_code)
        if result["fallback"]:
            raise ApiError("Jenis kerusakan manual tidak dikenali.", 400)
    else:
        result = analyze(complaint)

    vehicle = None
    if data.get("vehicle_id"):
        vehicle = db.session.get(Vehicle, as_int(data["vehicle_id"], "Kendaraan"))
        if not vehicle or vehicle.user_id != g.current_user.id:
            raise ApiError("Kendaraan tidak ditemukan pada akun Anda.", 404)

    record = AiAnalysis(
        user_id=g.current_user.id,
        vehicle_id=vehicle.id if vehicle else None,
        complaint=result["complaint"],
        summary=result["summary"][:255],
        estimate_min=result["estimate_min"],
        estimate_max=result["estimate_max"],
        payload=json.dumps(result, ensure_ascii=False),
    )
    db.session.add(record)
    db.session.commit()

    result["analysis_id"] = record.id
    result["vehicle_id"] = vehicle.id if vehicle else None
    return jsonify({"result": result})


@bp.get("/analyses")
@roles_required(ROLE_CUSTOMER)
def list_analyses():
    records = (
        AiAnalysis.query.filter_by(user_id=g.current_user.id)
        .order_by(AiAnalysis.created_at.desc())
        .limit(30)
        .all()
    )
    return jsonify({"analyses": [r.to_dict() for r in records]})


@bp.delete("/analyses/<int:analysis_id>")
@roles_required(ROLE_CUSTOMER)
def delete_analysis(analysis_id: int):
    record = db.session.get(AiAnalysis, analysis_id)
    if not record or record.user_id != g.current_user.id:
        raise ApiError("Riwayat analisis tidak ditemukan.", 404)
    db.session.delete(record)
    db.session.commit()
    return jsonify({"message": "Riwayat analisis dihapus."})


@bp.get("/summary")
@roles_required(ROLE_CUSTOMER)
def summary():
    """Ringkasan singkat untuk beranda customer."""
    user = g.current_user
    tickets = Ticket.query.filter_by(customer_id=user.id).order_by(Ticket.created_at.desc()).all()
    active = [t for t in tickets if t.status not in (STATUS_SELESAI, "dibatalkan")]
    pending = sum(len([i for i in t.items if i.approval_status == APPROVAL_PENDING]) for t in active)
    vehicles = Vehicle.query.filter_by(user_id=user.id).count()

    return jsonify(
        {
            "summary": {
                "active_tickets": len(active),
                "pending_approvals": pending,
                "vehicles": vehicles,
                "completed": len([t for t in tickets if t.status == STATUS_SELESAI]),
                "spent_total": sum(money(t.total_amount) for t in tickets if t.status == STATUS_SELESAI),
                "latest_ticket": tickets[0].to_dict() if tickets else None,
            }
        }
    )
