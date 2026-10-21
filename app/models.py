"""Model data BISA.

Skema dijaga tetap kompatibel dengan MariaDB/MySQL (sesuai SRS) sekaligus
bisa dijalankan di SQLite untuk pengembangan lokal.
"""

from datetime import datetime, timezone
from decimal import Decimal

from .extensions import db

# --- Peran pengguna -------------------------------------------------------
ROLE_CUSTOMER = "customer"
ROLE_MEKANIK = "mekanik"
ROLE_ADMIN = "admin"
ROLES = (ROLE_CUSTOMER, ROLE_MEKANIK, ROLE_ADMIN)

# --- Status tiket servis --------------------------------------------------
STATUS_MENUNGGU = "menunggu"
STATUS_DIKERJAKAN = "dikerjakan"
STATUS_SELESAI_PENGERJAAN = "selesai_pengerjaan"
STATUS_SELESAI = "selesai"
STATUS_DIBATALKAN = "dibatalkan"

STATUS_LABELS = {
    STATUS_MENUNGGU: "Menunggu",
    STATUS_DIKERJAKAN: "Dikerjakan",
    STATUS_SELESAI_PENGERJAAN: "Selesai Pengerjaan",
    STATUS_SELESAI: "Selesai",
    STATUS_DIBATALKAN: "Dibatalkan",
}

# --- Status persetujuan item ---------------------------------------------
APPROVAL_APPROVED = "approved"
APPROVAL_PENDING = "pending"
APPROVAL_REJECTED = "rejected"

ITEM_ESTIMASI = "estimasi"
ITEM_TAMBAHAN = "tambahan"

PAYMENT_METHODS = ("tunai", "qris")

# --- Jenis peristiwa tiket (audit trail + notifikasi) ---------------------
EVENT_CREATED = "created"
EVENT_CLAIMED = "claimed"
EVENT_ITEM_REQUESTED = "item_requested"
EVENT_ITEM_APPROVED = "item_approved"
EVENT_ITEM_REJECTED = "item_rejected"
EVENT_FINISHED = "finished"
EVENT_PAID = "paid"


def utcnow() -> datetime:
    """Waktu UTC naive agar konsisten di MariaDB maupun SQLite."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def money(value) -> float:
    """Konversi Decimal/None ke float untuk serialisasi JSON."""
    if value is None:
        return 0.0
    return float(Decimal(value))


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), nullable=False, unique=True, index=True)
    phone = db.Column(db.String(24), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(16), nullable=False, default=ROLE_CUSTOMER, index=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    vehicles = db.relationship("Vehicle", back_populates="owner", cascade="all, delete-orphan")
    tickets = db.relationship(
        "Ticket",
        back_populates="customer",
        foreign_keys="Ticket.customer_id",
        cascade="all, delete-orphan",
    )
    analyses = db.relationship("AiAnalysis", back_populates="user", cascade="all, delete-orphan")

    @property
    def masked_phone(self) -> str:
        """Masking nomor telepon di layar mekanik (NFR-08)."""
        if not self.phone:
            return "-"
        digits = "".join(ch for ch in self.phone if ch.isdigit())
        if len(digits) < 8:
            return self.phone
        return f"{digits[:4]}-****-{digits[-4:]}"

    def to_dict(self, include_contact: bool = False) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone if include_contact else self.masked_phone,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    plate_number = db.Column(db.String(16), nullable=False, index=True)
    brand = db.Column(db.String(60), nullable=True)
    model = db.Column(db.String(80), nullable=True)
    year = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    owner = db.relationship("User", back_populates="vehicles")
    tickets = db.relationship("Ticket", back_populates="vehicle")

    @property
    def label(self) -> str:
        detail = " ".join(part for part in (self.brand, self.model) if part)
        return f"{self.plate_number} · {detail}" if detail else self.plate_number

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "plate_number": self.plate_number,
            "brand": self.brand,
            "model": self.model,
            "year": self.year,
            "label": self.label,
        }


class Part(db.Model):
    """Master data sparepart (RF-11)."""

    __tablename__ = "parts"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(24), nullable=False, unique=True, index=True)
    name = db.Column(db.String(140), nullable=False)
    category = db.Column(db.String(60), nullable=False, default="Umum")
    unit = db.Column(db.String(20), nullable=False, default="pcs")
    price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    stock = db.Column(db.Integer, nullable=False, default=0)
    min_stock = db.Column(db.Integer, nullable=False, default=3)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "category": self.category,
            "unit": self.unit,
            "price": money(self.price),
            "stock": self.stock,
            "min_stock": self.min_stock,
            "is_active": self.is_active,
            "low_stock": self.stock <= self.min_stock,
        }


class Service(db.Model):
    """Master data ongkos jasa.

    Tidak eksplisit ada di RF-11, namun dibutuhkan UC-05 (estimasi biaya
    mencakup sparepart + ongkos jasa).
    """

    __tablename__ = "services"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(24), nullable=False, unique=True, index=True)
    name = db.Column(db.String(140), nullable=False)
    category = db.Column(db.String(60), nullable=False, default="Umum")
    price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "category": self.category,
            "price": money(self.price),
            "is_active": self.is_active,
        }


class Ticket(db.Model):
    __tablename__ = "tickets"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(24), nullable=False, unique=True, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=False, index=True)
    mechanic_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)

    complaint = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(24), nullable=False, default=STATUS_MENUNGGU, index=True)
    estimate_min = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    estimate_max = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    payment_method = db.Column(db.String(16), nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    invoice_number = db.Column(db.String(32), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    customer = db.relationship("User", back_populates="tickets", foreign_keys=[customer_id])
    mechanic = db.relationship("User", foreign_keys=[mechanic_id])
    vehicle = db.relationship("Vehicle", back_populates="tickets")
    items = db.relationship(
        "TicketItem",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketItem.id",
    )
    events = db.relationship(
        "TicketEvent",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketEvent.id",
    )

    @property
    def pending_items(self):
        return [item for item in self.items if item.approval_status == APPROVAL_PENDING]

    @property
    def has_pending_approval(self) -> bool:
        return bool(self.pending_items)

    def recalculate_total(self) -> Decimal:
        """Total tagihan = item estimasi + item tambahan yang disetujui.

        Item yang masih menunggu persetujuan tidak dihitung agar pelanggan
        tidak melihat tagihan yang belum ia setujui (UC-07).
        """
        total = Decimal("0")
        for item in self.items:
            if item.approval_status != APPROVAL_APPROVED:
                continue
            total += Decimal(item.unit_price) * item.qty
        self.total_amount = total
        return total

    @property
    def pending_total(self) -> Decimal:
        return sum(
            (Decimal(item.unit_price) * item.qty for item in self.items
             if item.approval_status == APPROVAL_PENDING),
            Decimal("0"),
        )

    def to_dict(self, detail: bool = False) -> dict:
        data = {
            "id": self.id,
            "code": self.code,
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "complaint": self.complaint,
            "estimate_min": money(self.estimate_min),
            "estimate_max": money(self.estimate_max),
            "total_amount": money(self.total_amount),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "vehicle": self.vehicle.to_dict() if self.vehicle else None,
            "customer": {
                "id": self.customer.id,
                "name": self.customer.name,
                "phone": self.customer.masked_phone,
            }
            if self.customer
            else None,
            "mechanic": {"id": self.mechanic.id, "name": self.mechanic.name}
            if self.mechanic
            else None,
            "pending_count": len(self.pending_items),
            "pending_total": money(self.pending_total),
            "payment_method": self.payment_method,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "invoice_number": self.invoice_number,
        }
        if detail:
            data["items"] = [item.to_dict() for item in self.items]
            data["events"] = [event.to_dict() for event in self.events]
        return data

class TicketEvent(db.Model):
    """Jejak audit setiap perubahan penting pada tiket servis.

    Dipakai untuk dua hal:
    1. Timeline transparansi pada detail tiket (materi tambahan UC-06..UC-13).
    2. Sumber notifikasi near-real-time (RF-09) — klien melakukan polling
       memakai `id` terakhir yang sudah dilihat sebagai kursor.
    """

    __tablename__ = "ticket_events"

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey("tickets.id"), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    kind = db.Column(db.String(24), nullable=False, index=True)
    message = db.Column(db.String(255), nullable=False, default="")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    ticket = db.relationship("Ticket", back_populates="events")
    actor = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "ticket_code": self.ticket.code if self.ticket else None,
            "kind": self.kind,
            "message": self.message,
            "actor": self.actor.name if self.actor else "Sistem",
            "created_at": self.created_at.isoformat(),
        }

def log_event(ticket: Ticket, kind: str, message: str, actor=None) -> TicketEvent:
    """Catat peristiwa tiket. Pemanggil bertanggung jawab atas commit."""
    event = TicketEvent(
        ticket_id=ticket.id,
        actor_id=getattr(actor, "id", None),
        kind=kind,
        message=message,
    )
    db.session.add(event)
    return event


class TicketItem(db.Model):
    __tablename__ = "ticket_items"

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey("tickets.id"), nullable=False, index=True)
    kind = db.Column(db.String(12), nullable=False, default="part")  # part | service
    part_id = db.Column(db.Integer, db.ForeignKey("parts.id"), nullable=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=True)
    name = db.Column(db.String(160), nullable=False)
    qty = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    source = db.Column(db.String(12), nullable=False, default=ITEM_ESTIMASI)
    approval_status = db.Column(db.String(12), nullable=False, default=APPROVAL_APPROVED)
    reason = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    ticket = db.relationship("Ticket", back_populates="items")
    part = db.relationship("Part")

    @property
    def subtotal(self) -> Decimal:
        return Decimal(self.unit_price) * self.qty

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "qty": self.qty,
            "unit_price": money(self.unit_price),
            "subtotal": money(self.subtotal),
            "source": self.source,
            "approval_status": self.approval_status,
            "reason": self.reason,
            "part_id": self.part_id,
            "service_id": self.service_id,
        }


class AiAnalysis(db.Model):
    """Riwayat analisis keluhan (padanan 'history chat' pada TOC)."""

    __tablename__ = "ai_analyses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=True)
    complaint = db.Column(db.Text, nullable=False)
    summary = db.Column(db.String(255), nullable=False, default="")
    estimate_min = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    estimate_max = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    payload = db.Column(db.Text, nullable=False, default="{}")  # JSON hasil analisis
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    user = db.relationship("User", back_populates="analyses")

    def to_dict(self) -> dict:
        import json

        return {
            "id": self.id,
            "complaint": self.complaint,
            "summary": self.summary,
            "estimate_min": money(self.estimate_min),
            "estimate_max": money(self.estimate_max),
            "created_at": self.created_at.isoformat(),
            "vehicle_id": self.vehicle_id,
            "result": json.loads(self.payload or "{}"),
        }
