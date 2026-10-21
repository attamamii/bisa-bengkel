"""Endpoint tiket servis: pembuatan, daftar, detail, approval, nota.

Mencakup UC-06 (buat tiket), UC-07 (respon approval), UC-13 (nota digital).
"""

from datetime import datetime

from flask import Blueprint, g, jsonify, request

from ..extensions import db
from ..models import (
    APPROVAL_APPROVED,
    APPROVAL_PENDING,
    APPROVAL_REJECTED,
    EVENT_CREATED,
    EVENT_ITEM_APPROVED,
    EVENT_ITEM_REJECTED,
    ITEM_ESTIMASI,
    ROLE_ADMIN,
    ROLE_CUSTOMER,
    ROLE_MEKANIK,
    STATUS_DIBATALKAN,
    STATUS_MENUNGGU,
    STATUS_SELESAI,
    Ticket,
    TicketItem,
    Vehicle,
    log_event,
    money,
)
from ..security import ApiError, auth_required, roles_required
from ..utils import as_int, clean, json_body, require


bp = Blueprint("tickets", __name__, url_prefix="/api/tickets")


def generate_ticket_code() -> str:
    today = datetime.now().strftime("%y%m%d")
    prefix = f"BISA-{today}-"
    count = Ticket.query.filter(Ticket.code.like(f"{prefix}%")).count() + 1
    while True:
        code = f"{prefix}{count:03d}"
        if not Ticket.query.filter_by(code=code).first():
            return code
        count += 1


def get_ticket_or_404(ticket_id: int) -> Ticket:
    ticket = db.session.get(Ticket, ticket_id)
    if not ticket:
        raise ApiError("Tiket servis tidak ditemukan.", 404)
    return ticket


def ensure_can_view(ticket: Ticket, user) -> None:
    if user.role == ROLE_CUSTOMER and ticket.customer_id != user.id:
        raise ApiError("Anda tidak berhak melihat tiket ini.", 403)
    if user.role == ROLE_MEKANIK and ticket.mechanic_id not in (None, user.id):
        raise ApiError("Tiket ini sedang dikerjakan mekanik lain.", 403)


def _notify_pending(ticket: Ticket) -> int:
    return len([i for i in ticket.items if i.approval_status == APPROVAL_PENDING])


@bp.get("")
@auth_required
def list_tickets():
    user = g.current_user
    query = Ticket.query

    if user.role == ROLE_CUSTOMER:
        query = query.filter(Ticket.customer_id == user.id)
    elif user.role == ROLE_MEKANIK:
        mine = request.args.get("scope") == "mine"
        if mine:
            query = query.filter(Ticket.mechanic_id == user.id)
        else:
            query = query.filter(
                db.or_(
                    Ticket.mechanic_id == user.id,
                    Ticket.mechanic_id.is_(None),
                    Ticket.status != STATUS_MENUNGGU,
                )
            )

    status = clean(request.args.get("status"))
    if status:
        query = query.filter(Ticket.status == status)

    tickets = query.order_by(Ticket.created_at.desc()).all()
    return jsonify({"tickets": [t.to_dict() for t in tickets]})


@bp.get("/<int:ticket_id>")
@auth_required
def ticket_detail(ticket_id: int):
    ticket = get_ticket_or_404(ticket_id)
    ensure_can_view(ticket, g.current_user)
    return jsonify({"ticket": ticket.to_dict(detail=True)})


@bp.post("")
@roles_required(ROLE_CUSTOMER)
def create_ticket():
    """UC-06: customer membuat tiket dari hasil estimasi AI."""
    user = g.current_user
    data = json_body()
    require(
        data,
        [
            ("vehicle_id", "Kendaraan"),
            ("complaint", "Keluhan"),
        ],
    )

    vehicle = db.session.get(Vehicle, as_int(data["vehicle_id"], "Kendaraan"))
    if not vehicle or vehicle.user_id != user.id:
        raise ApiError("Kendaraan tidak ditemukan pada akun Anda.", 404)

    complaint = clean(data["complaint"])
    if len(complaint) < 10:
        raise ApiError(
            "Ceritakan keluhan minimal 10 karakter agar mekanik paham.",
            400,
            {"complaint": "Keluhan terlalu singkat."},
        )

    if not vehicle.plate_number:
        raise ApiError("Plat nomor wajib diisi.", 400, {"plate_number": "Plat nomor wajib diisi."})

    items_payload = data.get("items") or []
    if not isinstance(items_payload, list) or not items_payload:
        raise ApiError("Estimasi biaya belum tersedia. Jalankan analisis keluhan dahulu.", 400)

    ticket = Ticket(
        code=generate_ticket_code(),
        customer_id=user.id,
        vehicle_id=vehicle.id,
        complaint=complaint,
        status=STATUS_MENUNGGU,
        estimate_min=0,
        estimate_max=0,
        total_amount=0,
    )
    db.session.add(ticket)
    db.session.flush()

    total = 0
    for raw in items_payload:
        item = TicketItem(
            ticket_id=ticket.id,
            kind=raw.get("kind") if raw.get("kind") in ("part", "service") else "part",
            part_id=raw.get("part_id"),
            service_id=raw.get("service_id"),
            name=clean(raw.get("name"))[:160] or "Item servis",
            qty=max(1, int(raw.get("qty") or 1)),
            unit_price=raw.get("unit_price") or 0,
            source=ITEM_ESTIMASI,
            approval_status=APPROVAL_APPROVED,
        )
        db.session.add(item)
        total += float(item.unit_price) * item.qty

    ticket.estimate_min = data.get("estimate_min") or total * 0.95
    ticket.estimate_max = data.get("estimate_max") or total * 1.15
    ticket.total_amount = total

    log_event(
        ticket,
        EVENT_CREATED,
        f"Tiket dibuat untuk {vehicle.plate_number} dari hasil analisis keluhan.",
        user,
    )

    db.session.commit()
    return (
        jsonify(
            {
                "message": f"Tiket servis {ticket.code} berhasil dibuat.",
                "ticket": ticket.to_dict(detail=True),
            }
        ),
        201,
    )


@bp.post("/<int:ticket_id>/decision")
@roles_required(ROLE_CUSTOMER)
def decide_item(ticket_id: int):
    """UC-07: customer menyetujui/menolak item tambahan."""
    user = g.current_user
    ticket = get_ticket_or_404(ticket_id)
    if ticket.customer_id != user.id:
        raise ApiError("Anda tidak berhak merespons tiket ini.", 403)
    if ticket.status in (STATUS_SELESAI, STATUS_DIBATALKAN):
        raise ApiError("Tiket sudah ditutup dan tidak bisa diubah.", 409)

    data = json_body()
    require(data, [("item_id", "Item"), ("decision", "Keputusan")])
    decision = clean(data["decision"]).lower()
    if decision not in (APPROVAL_APPROVED, APPROVAL_REJECTED):
        raise ApiError("Keputusan harus 'approved' atau 'rejected'.", 400)

    item = db.session.get(TicketItem, as_int(data["item_id"], "Item"))
    if not item or item.ticket_id != ticket.id:
        raise ApiError("Item tidak ditemukan pada tiket ini.", 404)
    if item.approval_status != APPROVAL_PENDING:
        raise ApiError("Item ini sudah direspons sebelumnya.", 409)

    item.approval_status = decision
    ticket.recalculate_total()

    label = "disetujui" if decision == APPROVAL_APPROVED else "ditolak"
    log_event(
        ticket,
        EVENT_ITEM_APPROVED if decision == APPROVAL_APPROVED else EVENT_ITEM_REJECTED,
        f"Customer {label} item '{item.name}' (Rp {money(item.subtotal):,.0f}).".replace(",", "."),
        user,
    )
    db.session.commit()

    return jsonify(
        {
            "message": f"Item '{item.name}' {label}. Total tagihan diperbarui.",
            "ticket": ticket.to_dict(detail=True),
        }
    )


@bp.get("/<int:ticket_id>/nota")
@auth_required
def nota(ticket_id: int):
    """UC-13: data nota digital (dipakai untuk pratinjau & cetak)."""
    ticket = get_ticket_or_404(ticket_id)
    user = g.current_user
    if user.role == ROLE_CUSTOMER and ticket.customer_id != user.id:
        raise ApiError("Anda tidak berhak melihat nota ini.", 403)
    if user.role == ROLE_MEKANIK:
        raise ApiError("Nota hanya dapat diakses customer dan admin.", 403)
    if ticket.status != STATUS_SELESAI:
        raise ApiError("Nota belum tersedia. Selesaikan pembayaran terlebih dahulu.", 409)

    items = [i.to_dict() for i in ticket.items if i.approval_status != APPROVAL_REJECTED]
    return jsonify(
        {
            "nota": {
                "invoice_number": ticket.invoice_number,
                "ticket_code": ticket.code,
                "issued_at": (ticket.paid_at or ticket.updated_at).isoformat(),
                "customer": ticket.customer.to_dict(include_contact=True),
                "vehicle": ticket.vehicle.to_dict(),
                "mechanic": ticket.mechanic.name if ticket.mechanic else "-",
                "complaint": ticket.complaint,
                "items": items,
                "total": money(ticket.total_amount),
                "payment_method": ticket.payment_method,
                "estimate_min": money(ticket.estimate_min),
                "estimate_max": money(ticket.estimate_max),
            }
        }
    )
