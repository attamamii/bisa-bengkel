"""Notifikasi near-real-time berbasis kursor (RF-09).

SRS meminta "push notification" saat mekanik mengajukan tambahan biaya dan
saat customer merespons. Lingkungan demo berjalan di satu server Flask tanpa
broker, jadi mekanismenya dibuat sebagai **polling ringan dengan kursor id**:

1. Setiap perubahan tiket dicatat sebagai `TicketEvent` (audit trail).
2. Klien memanggil `GET /api/notifications?after=<id_terakhir>` secara berkala.
3. Server hanya mengembalikan peristiwa baru yang memang terlihat oleh peran
   pengguna tersebut, sehingga trafiknya konstan dan tidak membocorkan data.
4. Klien menampilkan toast + badge tanpa memuat ulang halaman.

Desain ini setara dengan long-polling sederhana: latensi maksimum sebesar
interval polling (default 8 detik), jauh di bawah batas NFR-10.
"""

from flask import Blueprint, g, jsonify, request

from ..models import (
    APPROVAL_PENDING,
    ROLE_CUSTOMER,
    ROLE_MEKANIK,
    ROLE_ADMIN,
    Ticket,
    TicketEvent,
    TicketItem,
)
from ..security import auth_required
from ..utils import as_int

bp = Blueprint("notifications", __name__, url_prefix="/api")

MAX_EVENTS = 25

def _visible_query(user):
    """Batasi peristiwa sesuai hak akses peran (NFR-06)."""
    query = TicketEvent.query.join(Ticket, TicketEvent.ticket_id == Ticket.id)
    if user.role == ROLE_CUSTOMER:
        query = query.filter(Ticket.customer_id == user.id)
    elif user.role == ROLE_MEKANIK:
        query = query.filter(
            (Ticket.mechanic_id == user.id) | (Ticket.mechanic_id.is_(None))
        )
    # Admin melihat seluruh peristiwa bengkel.
    return query

def _pending_items(user):
    """Item yang menunggu keputusan customer pada tiket miliknya."""
    if user.role != ROLE_CUSTOMER:
        return []
    rows = (
        TicketItem.query.join(Ticket, TicketItem.ticket_id == Ticket.id)
        .filter(Ticket.customer_id == user.id, TicketItem.approval_status == APPROVAL_PENDING)
        .order_by(TicketItem.created_at.desc())
        .all()
    )
    return [
        {
            "id": item.id,
            "ticket_id": item.ticket_id,
            "ticket_code": item.ticket.code,
            "name": item.name,
            "qty": item.qty,
            "reason": item.reason,
            "subtotal": float(item.subtotal),
        }
        for item in rows
    ]

@bp.get("/notifications")
@auth_required
def notifications():
    """Peristiwa tiket baru sejak kursor `after` (RF-09)."""
    user = g.current_user
    after = as_int(request.args.get("after") or 0, "Kursor", minimum=0)

    query = _visible_query(user)
    if after:
        query = query.filter(TicketEvent.id > after)

    events = query.order_by(TicketEvent.id.asc()).limit(MAX_EVENTS).all()
    latest = TicketEvent.query.order_by(TicketEvent.id.desc()).first()

    pending = _pending_items(user)
    return jsonify(
        {
            "events": [event.to_dict() for event in events],
            "cursor": events[-1].id if events else after,
            "latest_id": latest.id if latest else 0,
            "pending_count": len(pending),
            "pending_items": pending[:5],
            "role": user.role,
        }
    )
