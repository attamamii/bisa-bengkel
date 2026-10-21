"""Endpoint sisi Admin: master data, pegawai, kasir, laporan pendapatan."""

from datetime import datetime, timedelta

from flask import Blueprint, Response, g, jsonify, request

from ..extensions import db
from ..models import (
    APPROVAL_APPROVED,
    EVENT_PAID,
    PAYMENT_METHODS,
    ROLE_ADMIN,
    ROLE_MEKANIK,
    STATUS_SELESAI,
    STATUS_SELESAI_PENGERJAAN,
    Part,
    Service,
    Ticket,
    TicketItem,
    User,
    log_event,
    money,
)
from ..security import ApiError, hash_password, roles_required
from ..utils import as_int, as_money, clean, json_body, require

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

WITA = timedelta(hours=8)


# ---------------------------------------------------------------- Master data
@bp.get("/parts")
@roles_required(ROLE_ADMIN)
def list_parts():
    q = clean(request.args.get("q"))
    query = Part.query
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(Part.name.like(like), Part.code.like(like), Part.category.like(like)))
    parts = query.order_by(Part.name.asc()).all()
    return jsonify({"parts": [p.to_dict() for p in parts]})


@bp.post("/parts")
@roles_required(ROLE_ADMIN)
def create_part():
    data = json_body()
    require(data, [("code", "Kode"), ("name", "Nama barang"), ("price", "Harga"), ("stock", "Stok")])

    code = clean(data["code"]).upper()
    if Part.query.filter_by(code=code).first():
        raise ApiError("Kode barang sudah dipakai.", 409, {"code": "Kode sudah terdaftar."})

    part = Part(
        code=code[:24],
        name=clean(data["name"])[:140],
        category=clean(data.get("category"))[:60] or "Umum",
        unit=clean(data.get("unit"))[:20] or "pcs",
        price=as_money(data["price"], "Harga"),
        stock=as_int(data["stock"], "Stok", minimum=0),
        min_stock=as_int(data.get("min_stock") or 3, "Stok minimum", minimum=0),
        is_active=True,
    )
    db.session.add(part)
    db.session.commit()
    return jsonify({"message": "Data barang berhasil disimpan.", "part": part.to_dict()}), 201


@bp.put("/parts/<int:part_id>")
@roles_required(ROLE_ADMIN)
def update_part(part_id: int):
    part = db.session.get(Part, part_id)
    if not part:
        raise ApiError("Barang tidak ditemukan.", 404)

    data = json_body()
    if "name" in data:
        part.name = clean(data["name"])[:140] or part.name
    if "category" in data:
        part.category = clean(data["category"])[:60] or "Umum"
    if "unit" in data:
        part.unit = clean(data["unit"])[:20] or "pcs"
    if "price" in data:
        part.price = as_money(data["price"], "Harga")
    if "stock" in data:
        part.stock = as_int(data["stock"], "Stok", minimum=0)
    if "min_stock" in data:
        part.min_stock = as_int(data["min_stock"], "Stok minimum", minimum=0)
    if "is_active" in data:
        part.is_active = bool(data["is_active"])

    db.session.commit()
    return jsonify({"message": "Data barang diperbarui.", "part": part.to_dict()})


@bp.delete("/parts/<int:part_id>")
@roles_required(ROLE_ADMIN)
def delete_part(part_id: int):
    part = db.session.get(Part, part_id)
    if not part:
        raise ApiError("Barang tidak ditemukan.", 404)

    used = TicketItem.query.filter_by(part_id=part.id).count()
    if used:
        part.is_active = False
        db.session.commit()
        return jsonify(
            {
                "message": "Barang sudah dipakai pada transaksi, jadi dinonaktifkan "
                "agar riwayat nota tetap utuh."
            }
        )

    db.session.delete(part)
    db.session.commit()
    return jsonify({"message": "Barang dihapus."})


@bp.get("/services")
@roles_required(ROLE_ADMIN)
def list_services():
    services = Service.query.order_by(Service.name.asc()).all()
    return jsonify({"services": [s.to_dict() for s in services]})


@bp.post("/services")
@roles_required(ROLE_ADMIN)
def create_service():
    data = json_body()
    require(data, [("code", "Kode"), ("name", "Nama jasa"), ("price", "Tarif")])

    code = clean(data["code"]).upper()
    if Service.query.filter_by(code=code).first():
        raise ApiError("Kode jasa sudah dipakai.", 409, {"code": "Kode sudah terdaftar."})

    service = Service(
        code=code[:24],
        name=clean(data["name"])[:140],
        category=clean(data.get("category"))[:60] or "Umum",
        price=as_money(data["price"], "Tarif"),
        is_active=True,
    )
    db.session.add(service)
    db.session.commit()
    return jsonify({"message": "Data jasa berhasil disimpan.", "service": service.to_dict()}), 201


@bp.put("/services/<int:service_id>")
@roles_required(ROLE_ADMIN)
def update_service(service_id: int):
    service = db.session.get(Service, service_id)
    if not service:
        raise ApiError("Jasa tidak ditemukan.", 404)

    data = json_body()
    if "name" in data:
        service.name = clean(data["name"])[:140] or service.name
    if "category" in data:
        service.category = clean(data["category"])[:60] or "Umum"
    if "price" in data:
        service.price = as_money(data["price"], "Tarif")
    if "is_active" in data:
        service.is_active = bool(data["is_active"])

    db.session.commit()
    return jsonify({"message": "Data jasa diperbarui.", "service": service.to_dict()})


# ------------------------------------------------------------------ Pegawai
@bp.get("/mechanics")
@roles_required(ROLE_ADMIN)
def list_mechanics():
    mechanics = User.query.filter_by(role=ROLE_MEKANIK).order_by(User.name.asc()).all()
    data = []
    for mech in mechanics:
        item = mech.to_dict(include_contact=True)
        item["active_tickets"] = Ticket.query.filter(
            Ticket.mechanic_id == mech.id,
            Ticket.status.in_(("dikerjakan", "menunggu")),
        ).count()
        data.append(item)
    return jsonify({"mechanics": data})


@bp.post("/mechanics")
@roles_required(ROLE_ADMIN)
def create_mechanic():
    data = json_body()
    require(data, [("name", "Nama"), ("email", "Email"), ("password", "Kata sandi")])

    email = clean(data["email"]).lower()
    if User.query.filter(db.func.lower(User.email) == email).first():
        raise ApiError(
            "Email sudah digunakan oleh pengguna lain.",
            409,
            {"email": "Email sudah terdaftar."},
        )

    password = str(data["password"])
    if len(password) < 8:
        raise ApiError(
            "Kata sandi minimal 8 karakter.",
            400,
            {"password": "Minimal 8 karakter."},
        )

    mech = User(
        name=clean(data["name"])[:120],
        email=email,
        phone=clean(data.get("phone")) or None,
        password_hash=hash_password(password),
        role=ROLE_MEKANIK,
        is_active=True,
    )
    db.session.add(mech)
    db.session.commit()
    return jsonify({"message": "Akun mekanik berhasil dibuat.", "mechanic": mech.to_dict(True)}), 201


@bp.put("/mechanics/<int:user_id>")
@roles_required(ROLE_ADMIN)
def update_mechanic(user_id: int):
    mech = db.session.get(User, user_id)
    if not mech or mech.role != ROLE_MEKANIK:
        raise ApiError("Akun mekanik tidak ditemukan.", 404)

    data = json_body()
    if "name" in data:
        mech.name = clean(data["name"])[:120] or mech.name
    if "phone" in data:
        mech.phone = clean(data["phone"]) or None
    if "is_active" in data:
        mech.is_active = bool(data["is_active"])
    if data.get("password"):
        password = str(data["password"])
        if len(password) < 8:
            raise ApiError("Kata sandi minimal 8 karakter.", 400, {"password": "Minimal 8 karakter."})
        mech.password_hash = hash_password(password)

    db.session.commit()
    return jsonify({"message": "Akun mekanik diperbarui.", "mechanic": mech.to_dict(True)})


# --------------------------------------------------------------------- Kasir
@bp.get("/cashier")
@roles_required(ROLE_ADMIN)
def cashier_queue():
    tickets = (
        Ticket.query.filter(Ticket.status == STATUS_SELESAI_PENGERJAAN)
        .order_by(Ticket.updated_at.asc())
        .all()
    )
    return jsonify({"tickets": [t.to_dict(detail=True) for t in tickets]})


@bp.post("/cashier/<int:ticket_id>/pay")
@roles_required(ROLE_ADMIN)
def pay(ticket_id: int):
    """UC-12 + RF-14: selesaikan transaksi dan potong stok otomatis."""
    ticket = db.session.get(Ticket, ticket_id)
    if not ticket:
        raise ApiError("Tiket servis tidak ditemukan.", 404)
    if ticket.status != STATUS_SELESAI_PENGERJAAN:
        raise ApiError("Tiket belum siap dibayar. Selesaikan pengerjaan terlebih dahulu.", 409)

    data = json_body()
    method = clean(data.get("method") or "tunai").lower()
    if method not in PAYMENT_METHODS:
        raise ApiError("Metode pembayaran harus 'tunai' atau 'qris'.", 400)

    pending = [i for i in ticket.items if i.approval_status == "pending"]
    if pending:
        names = ", ".join(i.name for i in pending[:3])
        raise ApiError(
            f"Masih ada {len(pending)} item menunggu persetujuan pelanggan ({names}). "
            "Pastikan pelanggan menyetujui atau menolak item tersebut.",
            409,
        )

    # Validasi stok sebelum memotong (mencegah stok minus).
    needed: dict[int, int] = {}
    for item in ticket.items:
        if item.kind == "part" and item.part_id and item.approval_status == APPROVAL_APPROVED:
            needed[item.part_id] = needed.get(item.part_id, 0) + item.qty

    locked_parts = {}
    for part_id, qty in needed.items():
        part = Part.query.with_for_update().filter_by(id=part_id).first()
        if not part:
            raise ApiError("Sparepart pada tiket sudah tidak tersedia.", 409)
        if part.stock < qty:
            raise ApiError(
                f"Stok {part.name} tidak cukup (tersisa {part.stock}, dibutuhkan {qty}).",
                409,
            )
        locked_parts[part_id] = (part, qty)

    # Potong stok (padanan trigger/stored procedure pada MariaDB).
    for part, qty in locked_parts.values():
        part.stock -= qty

    ticket.recalculate_total()
    ticket.status = STATUS_SELESAI
    ticket.payment_method = method
    ticket.paid_at = datetime.utcnow()
    ticket.invoice_number = f"INV-{datetime.now().strftime('%y%m%d')}-{ticket.id:04d}"

    log_event(
        ticket,
        EVENT_PAID,
        f"Pembayaran {method.upper()} diterima. Nota {ticket.invoice_number} diterbitkan.",
        g.current_user,
    )

    db.session.commit()
    return jsonify(
        {
            "message": "Transaksi selesai. Stok barang sudah diperbarui.",
            "ticket": ticket.to_dict(detail=True),
        }
    )


# ------------------------------------------------------------------ Laporan
@bp.get("/dashboard")
@roles_required(ROLE_ADMIN)
def dashboard():
    """UC-15: rekap pendapatan harian/bulanan."""
    period = clean(request.args.get("period") or "today").lower()
    now_wita = datetime.utcnow() + WITA
    today = now_wita.date()

    if period == "month":
        start = today.replace(day=1)
    elif period == "week":
        start = today - timedelta(days=6)
    else:
        start = today

    paid = Ticket.query.filter(Ticket.status == STATUS_SELESAI).all()
    paid_wita = [(t, (t.paid_at or t.updated_at) + WITA) for t in paid]

    period_tickets = [t for t, dt in paid_wita if start <= dt.date() <= today]
    revenue = sum(money(t.total_amount) for t in period_tickets)
    vehicles_served = len({t.vehicle_id for t in period_tickets})

    # Seri harian 7 hari terakhir untuk grafik sederhana.
    series = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        day_total = sum(money(t.total_amount) for t, dt in paid_wita if dt.date() == day)
        series.append({"date": day.isoformat(), "total": day_total})

    # Sparepart terlaris pada periode.
    item_counter: dict[str, dict] = {}
    period_ids = {t.id for t in period_tickets}
    if period_ids:
        items = TicketItem.query.filter(TicketItem.ticket_id.in_(period_ids)).all()
        for item in items:
            if item.approval_status != APPROVAL_APPROVED:
                continue
            entry = item_counter.setdefault(
                item.name, {"name": item.name, "qty": 0, "total": 0.0}
            )
            entry["qty"] += item.qty
            entry["total"] += money(item.unit_price) * item.qty
    top_items = sorted(item_counter.values(), key=lambda x: x["total"], reverse=True)[:5]

    status_counts = {key: 0 for key in ("menunggu", "dikerjakan", "selesai_pengerjaan", "selesai")}
    for ticket in Ticket.query.all():
        if ticket.status in status_counts:
            status_counts[ticket.status] += 1

    pending_approvals = TicketItem.query.filter_by(approval_status="pending").count()
    low_stock = Part.query.filter(Part.is_active.is_(True), Part.stock <= Part.min_stock).count()

    return jsonify(
        {
            "period": period,
            "stats": {
                "revenue": revenue,
                "tickets": len(period_tickets),
                "vehicles": vehicles_served,
                "average": (revenue / len(period_tickets)) if period_tickets else 0,
                "pending_approvals": pending_approvals,
                "low_stock": low_stock,
                "status_counts": status_counts,
            },
            "series": series,
            "top_items": top_items,
            "recent": [t.to_dict() for t in sorted(period_tickets, key=lambda t: t.paid_at or t.updated_at, reverse=True)[:6]],
        }
    )


@bp.get("/customers")
@roles_required(ROLE_ADMIN)
def list_customers():
    customers = User.query.filter_by(role="customer").order_by(User.created_at.desc()).all()
    result = []
    for customer in customers:
        total_spent = sum(
            money(t.total_amount) for t in customer.tickets if t.status == STATUS_SELESAI
        )
        result.append(
            {
                **customer.to_dict(include_contact=True),
                "vehicle_count": len(customer.vehicles),
                "ticket_count": len(customer.tickets),
                "total_spent": total_spent,
            }
        )
    return jsonify({"customers": result})

# --------------------------------------------------- Ekspor laporan (CSV)
@bp.get("/dashboard/export.csv")
@roles_required(ROLE_ADMIN)
def export_dashboard_csv():
    """RF-17 (tambahan): unduh rekap transaksi lunas sebagai CSV.

    Memakai koma sebagai pemisah dan penanda urutan (BOM) agar Excel
    membaca karakter Indonesia dengan benar.
    """
    import csv
    import io

    period = clean(request.args.get("period") or "today").lower()
    now_wita = datetime.utcnow() + WITA
    today = now_wita.date()

    if period == "month":
        start = today.replace(day=1)
    elif period == "week":
        start = today - timedelta(days=6)
    else:
        start = today

    tickets = [
        t
        for t in Ticket.query.filter(Ticket.status == STATUS_SELESAI).all()
        if start <= ((t.paid_at or t.updated_at) + WITA).date() <= today
    ]
    tickets.sort(key=lambda t: t.paid_at or t.updated_at)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Nomor Nota",
            "Tanggal Bayar (WITA)",
            "Kode Tiket",
            "Pelanggan",
            "Kendaraan",
            "Mekanik",
            "Metode",
            "Jumlah Item",
            "Total (Rp)",
        ]
    )
    for t in tickets:
        writer.writerow(
            [
                t.invoice_number or "-",
                ((t.paid_at or t.updated_at) + WITA).strftime("%Y-%m-%d %H:%M"),
                t.code,
                t.customer.name if t.customer else "-",
                t.vehicle.plate_number if t.vehicle else "-",
                t.mechanic.name if t.mechanic else "-",
                (t.payment_method or "-").upper(),
                len([i for i in t.items if i.approval_status == APPROVAL_APPROVED]),
                f"{money(t.total_amount):.0f}",
            ]
        )

    total = sum(money(t.total_amount) for t in tickets)
    writer.writerow([])
    writer.writerow(["TOTAL", "", "", "", "", "", "", len(tickets), f"{total:.0f}"])

    filename = f"laporan-bisa-{period}-{today.isoformat()}.csv"
    return Response(
        "\ufeff" + buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
