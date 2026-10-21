"""Data demo BISA.

Dijalankan otomatis saat basis data masih kosong, atau manual:
    python -m app.seed
"""

from datetime import datetime, timedelta
from decimal import Decimal

from .extensions import db
from .models import (
    APPROVAL_APPROVED,
    APPROVAL_PENDING,
    ITEM_ESTIMASI,
    ITEM_TAMBAHAN,
    ROLE_ADMIN,
    ROLE_CUSTOMER,
    ROLE_MEKANIK,
    STATUS_DIKERJAKAN,
    STATUS_MENUNGGU,
    STATUS_SELESAI,
    STATUS_SELESAI_PENGERJAAN,
    AiAnalysis,
    Part,
    Service,
    Ticket,
    TicketItem,
    User,
    Vehicle,
)
from .security import hash_password

PARTS = [
    ("BRK-01", "Kampas Rem Depan", "Rem", "set", 185000, 20, 5),
    ("BRK-02", "Kampas Rem Belakang", "Rem", "set", 165000, 18, 5),
    ("BRK-03", "Disc Brake Rotor", "Rem", "pcs", 420000, 8, 3),
    ("BRK-04", "Minyak Rem DOT 4", "Rem", "botol", 45000, 30, 8),
    ("CLG-01", "Coolant Radiator 4L", "Pendingin", "jerigen", 120000, 25, 6),
    ("CLG-02", "Thermostat", "Pendingin", "pcs", 210000, 10, 3),
    ("CLG-03", "Selang Radiator", "Pendingin", "pcs", 95000, 15, 4),
    ("ELK-01", "Aki 12V 60Ah", "Kelistrikan", "unit", 850000, 6, 2),
    ("ELK-02", "Busi Iridium", "Kelistrikan", "pcs", 95000, 40, 10),
    ("ELK-03", "Lampu Halogen H4", "Kelistrikan", "pcs", 65000, 35, 10),
    ("SUS-01", "Shock Absorber Depan", "Suspensi", "pcs", 650000, 6, 2),
    ("SUS-02", "Shock Absorber Belakang", "Suspensi", "pcs", 580000, 6, 2),
    ("SUS-03", "Bushing Arm", "Suspensi", "pcs", 120000, 20, 5),
    ("TRN-01", "Kampas Kopling Set", "Transmisi", "set", 480000, 7, 2),
    ("TRN-02", "Oli Transmisi Matic 1L", "Transmisi", "botol", 135000, 22, 6),
    ("OIL-01", "Oli Mesin 4L", "Servis Rutin", "jerigen", 320000, 30, 8),
    ("OIL-02", "Filter Oli", "Servis Rutin", "pcs", 55000, 40, 10),
    ("OIL-03", "Filter Udara", "Servis Rutin", "pcs", 85000, 25, 6),
    ("AC-01", "Freon R134a", "AC", "tabung", 150000, 20, 5),
    ("AC-02", "Filter Kabin", "AC", "pcs", 75000, 18, 5),
    ("EXH-01", "Muffler Knalpot", "Knalpot", "pcs", 750000, 4, 2),
    ("BAN-01", "Ban 185/65 R15", "Ban", "pcs", 850000, 12, 4),
]

SERVICES = [
    ("JSR-01", "Jasa Ganti Kampas Rem", "Rem", 75000),
    ("JSR-02", "Jasa Servis Sistem Rem", "Rem", 120000),
    ("JSR-03", "Jasa Servis Radiator", "Pendingin", 150000),
    ("JSR-04", "Jasa Ganti Aki", "Kelistrikan", 50000),
    ("JSR-05", "Jasa Tune Up Mesin", "Servis Rutin", 250000),
    ("JSR-06", "Jasa Ganti Oli", "Servis Rutin", 40000),
    ("JSR-07", "Jasa Servis Suspensi", "Suspensi", 200000),
    ("JSR-08", "Jasa Servis Transmisi", "Transmisi", 300000),
    ("JSR-09", "Jasa Servis AC", "AC", 180000),
    ("JSR-10", "Jasa Balancing & Spooring", "Ban", 150000),
    ("JSR-11", "Jasa Inspeksi Menyeluruh", "Umum", 100000),
    ("JSR-12", "Jasa Las Knalpot", "Knalpot", 90000),
    ("JSR-13", "Jasa Ganti Ban", "Ban", 60000),
]

ACCOUNTS = [
    ("Muhammad Afdhalul Adam", "admin@bisa.id", "081234567890", "Admin#123", ROLE_ADMIN),
    ("Andi Firmansyah", "andi@bisa.id", "081234567891", "Mekanik#123", ROLE_MEKANIK),
    ("Joko Susilo", "joko@bisa.id", "081234567892", "Mekanik#123", ROLE_MEKANIK),
    ("Budi Santoso", "budi@bisa.id", "081234567893", "Customer#123", ROLE_CUSTOMER),
    ("Sari Dewi", "sari@bisa.id", "081234567894", "Customer#123", ROLE_CUSTOMER),
    ("Rizky Pratama", "rizky@bisa.id", "081234567895", "Customer#123", ROLE_CUSTOMER),
]


def _ticket_code(when: datetime, seq: int) -> str:
    return f"BISA-{when.strftime('%y%m%d')}-{seq:03d}"


def _part(code: str) -> Part:
    return Part.query.filter_by(code=code).first()


def _service(code: str) -> Service:
    return Service.query.filter_by(code=code).first()


def _add_item(ticket, *, part_code=None, service_code=None, qty=1,
              source=ITEM_ESTIMASI, approval=APPROVAL_APPROVED, reason=None):
    part = _part(part_code) if part_code else None
    service = _service(service_code) if service_code else None
    item = TicketItem(
        ticket_id=ticket.id,
        kind="part" if part else "service",
        part_id=part.id if part else None,
        service_id=service.id if service else None,
        name=part.name if part else service.name,
        qty=qty,
        unit_price=part.price if part else service.price,
        source=source,
        approval_status=approval,
        reason=reason,
        created_at=ticket.created_at,
    )
    db.session.add(item)
    return item


def seed_all() -> None:
    for code, name, category, unit, price, stock, min_stock in PARTS:
        db.session.add(
            Part(
                code=code,
                name=name,
                category=category,
                unit=unit,
                price=Decimal(price),
                stock=stock,
                min_stock=min_stock,
            )
        )

    for code, name, category, price in SERVICES:
        db.session.add(
            Service(code=code, name=name, category=category, price=Decimal(price))
        )

    users = {}
    for name, email, phone, password, role in ACCOUNTS:
        user = User(
            name=name,
            email=email,
            phone=phone,
            password_hash=hash_password(password),
            role=role,
        )
        db.session.add(user)
        users[email] = user

    db.session.flush()

    vehicle_specs = [
        ("budi@bisa.id", "DD 1234 AB", "Toyota", "Avanza G", 2019),
        ("sari@bisa.id", "DD 5678 CD", "Honda", "Brio Satya", 2021),
        ("rizky@bisa.id", "DD 9012 EF", "Mitsubishi", "Xpander Ultimate", 2022),
    ]
    vehicles = {}
    for email, plate, brand, model, year in vehicle_specs:
        vehicle = Vehicle(
            user_id=users[email].id,
            plate_number=plate,
            brand=brand,
            model=model,
            year=year,
        )
        db.session.add(vehicle)
        vehicles[plate] = vehicle

    db.session.flush()

    admin = users["admin@bisa.id"]
    andi = users["andi@bisa.id"]
    joko = users["joko@bisa.id"]
    budi = users["budi@bisa.id"]
    sari = users["sari@bisa.id"]
    rizky = users["rizky@bisa.id"]

    now = datetime.now().replace(microsecond=0)
    day = now.replace(hour=9, minute=15, second=0)

    # 1) Tiket baru menunggu dikerjakan.
    t1 = Ticket(
        code=_ticket_code(day, 1),
        customer_id=budi.id,
        vehicle_id=vehicles["DD 1234 AB"].id,
        complaint="Rem depan bunyi berdecit dan pedal terasa blong saat mengerem.",
        status=STATUS_MENUNGGU,
        created_at=day,
        updated_at=day,
    )
    db.session.add(t1)
    db.session.flush()
    _add_item(t1, part_code="BRK-01")
    _add_item(t1, part_code="BRK-04")
    _add_item(t1, service_code="JSR-01")
    t1.estimate_min = Decimal("290000")
    t1.estimate_max = Decimal("350000")
    t1.total_amount = Decimal("305000")

    # 2) Tiket sedang dikerjakan + ada item menunggu persetujuan.
    t2_day = day + timedelta(minutes=90)
    t2 = Ticket(
        code=_ticket_code(t2_day, 2),
        customer_id=sari.id,
        vehicle_id=vehicles["DD 5678 CD"].id,
        mechanic_id=andi.id,
        complaint="AC tidak dingin dan ada bunyi berisik dari blower kabin.",
        status=STATUS_DIKERJAKAN,
        created_at=t2_day,
        updated_at=t2_day + timedelta(minutes=40),
    )
    db.session.add(t2)
    db.session.flush()
    _add_item(t2, service_code="JSR-09")
    _add_item(t2, part_code="AC-01")
    _add_item(
        t2,
        part_code="AC-02",
        source=ITEM_TAMBAHAN,
        approval=APPROVAL_PENDING,
        reason="Filter kabin ditemukan tersumbat debu tebal saat pembongkaran.",
    )
    t2.estimate_min = Decimal("250000")
    t2.estimate_max = Decimal("330000")
    t2.recalculate_total()

    # 3) Pengerjaan selesai, menunggu pembayaran di kasir.
    t3_day = now - timedelta(hours=5)
    t3 = Ticket(
        code=_ticket_code(t3_day, 3),
        customer_id=rizky.id,
        vehicle_id=vehicles["DD 9012 EF"].id,
        mechanic_id=joko.id,
        complaint="Servis rutin 40.000 km, ingin ganti oli dan cek filter udara.",
        status=STATUS_SELESAI_PENGERJAAN,
        created_at=t3_day,
        updated_at=now - timedelta(hours=1),
    )
    db.session.add(t3)
    db.session.flush()
    _add_item(t3, part_code="OIL-01")
    _add_item(t3, part_code="OIL-02")
    _add_item(t3, part_code="OIL-03")
    _add_item(t3, service_code="JSR-06")
    t3.estimate_min = Decimal("470000")
    t3.estimate_max = Decimal("570000")
    t3.recalculate_total()

    # 4) Transaksi lunas beberapa hari terakhir (untuk grafik laporan).
    paid_specs = [
        (budi, "DD 1234 AB", 1, "Suspensi bunyi gluduk saat jalan bergelombang.",
         [("SUS-01", "part"), ("SUS-03", "part")], [("JSR-07", "service")], "tunai"),
        (sari, "DD 5678 CD", 3, "Aki lemah, starter hanya klik saat diputar.",
         [("ELK-01", "part")], [("JSR-04", "service")], "qris"),
        (rizky, "DD 9012 EF", 5, "Rem belakang kurang pakem dan berbunyi.",
         [("BRK-02", "part"), ("BRK-04", "part")], [("JSR-02", "service")], "tunai"),
    ]

    seq = 4
    for customer, plate, days_ago, complaint, parts, services, method in paid_specs:
        when = (now - timedelta(days=days_ago)).replace(hour=10, minute=30, second=0)
        ticket = Ticket(
            code=_ticket_code(when, seq),
            customer_id=customer.id,
            vehicle_id=vehicles[plate].id,
            mechanic_id=andi.id if seq % 2 == 0 else joko.id,
            complaint=complaint,
            status=STATUS_SELESAI,
            created_at=when,
            updated_at=when + timedelta(hours=2),
            payment_method=method,
            paid_at=when + timedelta(hours=2),
            invoice_number=f"INV-{when.strftime('%y%m%d')}-{seq:04d}",
        )
        db.session.add(ticket)
        db.session.flush()
        for code, _kind in parts:
            _add_item(ticket, part_code=code)
        for code, _kind in services:
            _add_item(ticket, service_code=code)
        ticket.recalculate_total()
        ticket.estimate_min = ticket.total_amount * Decimal("0.95")
        ticket.estimate_max = ticket.total_amount * Decimal("1.15")
        seq += 1

    # Riwayat analisis AI pada beranda customer.
    analyses = [
        (budi, "Rem depan bunyi berdecit dan pedal terasa blong saat mengerem.", "Sistem Rem", 290000, 350000),
        (sari, "AC tidak dingin dan ada bunyi berisik dari blower kabin.", "Sistem AC & Kabin", 250000, 330000),
        (rizky, "Servis rutin 40.000 km, ingin ganti oli dan cek filter udara.", "Servis Rutin & Pelumasan", 470000, 570000),
    ]
    for user, complaint, summary, low, high in analyses:
        db.session.add(
            AiAnalysis(
                user_id=user.id,
                complaint=complaint,
                summary=summary,
                estimate_min=Decimal(low),
                estimate_max=Decimal(high),
                payload='{"summary": "%s"}' % summary,
                created_at=now - timedelta(hours=3),
            )
        )

    db.session.commit()


if __name__ == "__main__":
    from . import create_app

    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()
        seed_all()
        print("Data demo BISA berhasil dibuat.")
