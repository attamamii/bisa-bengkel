"""Endpoint sisi bengkel (Mekanik & Admin): antrean, tambahan item, selesai kerja."""

from flask import Blueprint, g, jsonify, request

from ..extensions import db
from ..models import (
    APPROVAL_PENDING,
    EVENT_CLAIMED,
    EVENT_FINISHED,
    EVENT_ITEM_REQUESTED,
    ITEM_TAMBAHAN,
    ROLE_ADMIN,
    ROLE_MEKANIK,
    STATUS_DIKERJAKAN,
    STATUS_MENUNGGU,
    STATUS_SELESAI_PENGERJAAN,
    Part,
    Service,
    Ticket,
    TicketItem,
    log_event,
)
from ..security import ApiError, roles_required
from ..utils import as_int, clean, json_body, require

bp = Blueprint("workshop", __name__, url_prefix="/api/workshop")

STAFF = (ROLE_MEKANIK, ROLE_ADMIN)


def _ticket_or_404(ticket_id: int) -> Ticket:
    ticket = db.session.get(Ticket, ticket_id)
    if not ticket:
        raise ApiError("Tiket servis tidak ditemukan.", 404)
    return ticket


def _ensure_assigned(ticket: Ticket, user) -> None:
    if user.role == ROLE_ADMIN:
        return
    if ticket.mechanic_id is None:
        raise ApiError("Ambil tiket ini terlebih dahulu sebelum mulai bekerja.", 409)
    if ticket.mechanic_id != user.id:
        raise ApiError("Tiket ini sedang dikerjakan mekanik lain.", 403)


@bp.get("/board")
@roles_required(*STAFF)
def board():
    """UC-09: papan tugas mekanik (Kanban)."""
    tickets = Ticket.query.order_by(Ticket.created_at.asc()).all()
    buckets = {
        STATUS_MENUNGGU: [],
        STATUS_DIKERJAKAN: [],
        STATUS_SELESAI_PENGERJAAN: [],
    }
    for ticket in tickets:
        if ticket.status in buckets:
            buckets[ticket.status].append(ticket.to_dict())

    stats = {
        "menunggu": len(buckets[STATUS_MENUNGGU]),
        "dikerjakan": len(buckets[STATUS_DIKERJAKAN]),
        "selesai_pengerjaan": len(buckets[STATUS_SELESAI_PENGERJAAN]),
    }
    return jsonify({"buckets": buckets, "stats": stats, "today": _today_done()})


def _today_done() -> int:
    from datetime import datetime

    today = datetime.now().date()
    return Ticket.query.filter(
        Ticket.status.in_(("selesai", "selesai_pengerjaan")),
        db.func.date(Ticket.updated_at) == today,
    ).count()


@bp.post("/tickets/<int:ticket_id>/claim")
@roles_required(*STAFF)
def claim(ticket_id: int):
    """Mekanik mengambil tiket dari antrean."""
    user = g.current_user
    ticket = _ticket_or_404(ticket_id)

    if ticket.status != STATUS_MENUNGGU:
        raise ApiError("Tiket ini sudah diambil atau sedang diproses.", 409)
    if user.role == ROLE_MEKANIK and ticket.mechanic_id not in (None, user.id):
        raise ApiError("Tiket sudah diklaim mekanik lain.", 409)

    ticket.mechanic_id = user.id if user.role == ROLE_MEKANIK else ticket.mechanic_id
    ticket.status = STATUS_DIKERJAKAN
    log_event(
        ticket,
        EVENT_CLAIMED,
        f"Tiket diambil oleh {user.name} dan mulai dikerjakan.",
        user,
    )
    db.session.commit()
    return jsonify({"message": f"Tiket {ticket.code} siap dikerjakan.", "ticket": ticket.to_dict(detail=True)})


@bp.post("/tickets/<int:ticket_id>/finish")
@roles_required(*STAFF)
def finish(ticket_id: int):
    """Mekanik menandai pengerjaan selesai → masuk meja kasir."""
    user = g.current_user
    ticket = _ticket_or_404(ticket_id)
    _ensure_assigned(ticket, user)

    if ticket.status != STATUS_DIKERJAKAN:
        raise ApiError("Hanya tiket berstatus 'Dikerjakan' yang bisa diselesaikan.", 409)

    pending = len([i for i in ticket.items if i.approval_status == APPROVAL_PENDING])
    if pending:
        raise ApiError(
            f"Masih ada {pending} item menunggu persetujuan pelanggan. "
            "Pastikan pelanggan merespons sebelum menutup pengerjaan.",
            409,
        )

    ticket.recalculate_total()
    ticket.status = STATUS_SELESAI_PENGERJAAN
    log_event(
        ticket,
        EVENT_FINISHED,
        f"Pengerjaan selesai oleh {user.name}. Tiket diteruskan ke kasir.",
        user,
    )
    db.session.commit()
    return jsonify(
        {
            "message": f"Pengerjaan {ticket.code} selesai. Tiket diteruskan ke kasir.",
            "ticket": ticket.to_dict(detail=True),
        }
    )


@bp.post("/tickets/<int:ticket_id>/items")
@roles_required(*STAFF)
def add_item(ticket_id: int):
    """UC-10: mekanik mengajukan sparepart/jasa tambahan (pending approval)."""
    user = g.current_user
    ticket = _ticket_or_404(ticket_id)
    _ensure_assigned(ticket, user)

    if ticket.status != STATUS_DIKERJAKAN:
        raise ApiError("Tambahan item hanya bisa diajukan saat tiket dikerjakan.", 409)

    data = json_body()
    require(data, [("kind", "Jenis item"), ("reason", "Alasan penambahan")])
    kind = clean(data["kind"]).lower()
    reason = clean(data["reason"])

    if kind not in ("part", "service"):
        raise ApiError("Jenis item harus 'part' atau 'service'.", 400)
    if len(reason) < 5:
        raise ApiError(
            "Alasan penambahan minimal 5 karakter agar transparan bagi pelanggan.",
            400,
            {"reason": "Jelaskan alasan penggantian."},
        )

    qty = as_int(data.get("qty") or 1, "Jumlah", minimum=1)

    if kind == "part":
        require(data, [("part_id", "Sparepart")])
        part = db.session.get(Part, as_int(data["part_id"], "Sparepart"))
        if not part or not part.is_active:
            raise ApiError("Sparepart tidak ditemukan.", 404)
        if part.stock <= 0:
            raise ApiError("Stok barang kosong, harap lapor ke Admin.", 409)
        if part.stock < qty:
            raise ApiError(f"Stok {part.name} hanya tersisa {part.stock} {part.unit}.", 409)
        name, unit_price, part_id, service_id = part.name, part.price, part.id, None
    else:
        require(data, [("service_id", "Jasa")])
        service = db.session.get(Service, as_int(data["service_id"], "Jasa"))
        if not service or not service.is_active:
            raise ApiError("Jasa tidak ditemukan.", 404)
        name, unit_price, part_id, service_id = service.name, service.price, None, service.id

    item = TicketItem(
        ticket_id=ticket.id,
        kind=kind,
        part_id=part_id,
        service_id=service_id,
        name=name,
        qty=qty,
        unit_price=unit_price,
        source=ITEM_TAMBAHAN,
        approval_status=APPROVAL_PENDING,
        reason=reason,
    )
    db.session.add(item)
    db.session.flush()
    ticket.recalculate_total()
    log_event(
        ticket,
        EVENT_ITEM_REQUESTED,
        f"{user.name} mengajukan {qty} x {name} — menunggu persetujuan Customer.",
        user,
    )
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Item tambahan diajukan. Menunggu persetujuan pelanggan.",
                "ticket": ticket.to_dict(detail=True),
            }
        ),
        201,
    )


@bp.get("/catalog/parts")
@roles_required(*STAFF)
def catalog_parts():
    q = clean(request.args.get("q"))
    query = Part.query.filter(Part.is_active.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(Part.name.like(like), Part.code.like(like)))
    parts = query.order_by(Part.name.asc()).limit(30).all()
    return jsonify({"parts": [p.to_dict() for p in parts]})


@bp.get("/catalog/services")
@roles_required(*STAFF)
def catalog_services():
    q = clean(request.args.get("q"))
    query = Service.query.filter(Service.is_active.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(Service.name.like(like), Service.code.like(like)))
    services = query.order_by(Service.name.asc()).limit(30).all()
    return jsonify({"services": [s.to_dict() for s in services]})
