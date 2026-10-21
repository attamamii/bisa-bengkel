"""Endpoint autentikasi (UC-01, UC-02, UC-03)."""

import re
import time

from flask import Blueprint, current_app, g, jsonify, request

from ..extensions import db
from ..models import ROLE_CUSTOMER, User
from ..security import (
    ApiError,
    auth_required,
    create_token,
    hash_password,
    verify_password,
)
from ..utils import clean, json_body, require

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")
PHONE_RE = re.compile(r"^[0-9+\-\s]{8,20}$")

# Penghitung percobaan gagal per email (UC-02: kunci sementara).
_ATTEMPTS: dict[str, dict] = {}


def _check_lock(email: str) -> None:
    state = _ATTEMPTS.get(email)
    if not state:
        return
    remaining = state.get("until", 0) - time.time()
    if remaining > 0:
        raise ApiError(
            f"Terlalu banyak percobaan gagal. Coba lagi dalam {int(remaining) + 1} detik.",
            429,
            {"email": "Form login dikunci sementara."},
        )


def _record_failure(email: str) -> None:
    limit = current_app.config["LOGIN_MAX_ATTEMPTS"]
    lock_seconds = current_app.config["LOGIN_LOCK_SECONDS"]
    state = _ATTEMPTS.setdefault(email, {"count": 0, "until": 0})
    state["count"] += 1
    if state["count"] >= limit:
        state["count"] = 0
        state["until"] = time.time() + lock_seconds


def _clear_attempts(email: str) -> None:
    _ATTEMPTS.pop(email, None)


@bp.post("/register")
def register():
    data = json_body()
    require(data, [("name", "Nama"), ("email", "Email"), ("password", "Kata sandi")])

    name = clean(data["name"])
    email = clean(data["email"]).lower()
    password = str(data["password"])
    phone = clean(data.get("phone"))

    errors = {}
    if len(name) < 3:
        errors["name"] = "Nama minimal 3 karakter."
    if not EMAIL_RE.match(email):
        errors["email"] = "Format email tidak valid."
    if len(password) < 8:
        errors["password"] = "Kata sandi minimal 8 karakter."
    if phone and not PHONE_RE.match(phone):
        errors["phone"] = "Nomor HP tidak valid."
    if errors:
        raise ApiError("Periksa kembali data pendaftaran.", 400, errors)

    if User.query.filter(db.func.lower(User.email) == email).first():
        raise ApiError(
            "Email sudah digunakan, silakan login.",
            409,
            {"email": "Email sudah terdaftar."},
        )

    user = User(
        name=name,
        email=email,
        phone=phone or None,
        password_hash=hash_password(password),
        role=ROLE_CUSTOMER,
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Akun berhasil dibuat. Silakan login.", "user": user.to_dict()}), 201


@bp.post("/login")
def login():
    data = json_body()
    require(data, [("email", "Email"), ("password", "Kata sandi")])

    email = clean(data["email"]).lower()
    password = str(data["password"])

    _check_lock(email)

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user or not verify_password(password, user.password_hash):
        _record_failure(email)
        raise ApiError(
            "Email atau kata sandi tidak cocok.",
            401,
            {"email": "Periksa email dan kata sandi Anda."},
        )

    if not user.is_active:
        raise ApiError("Akun Anda dinonaktifkan. Hubungi admin bengkel.", 403)

    _clear_attempts(email)
    return jsonify({"token": create_token(user), "user": user.to_dict(include_contact=True)})


@bp.get("/me")
@auth_required
def me():
    return jsonify({"user": g.current_user.to_dict(include_contact=True)})


@bp.post("/logout")
@auth_required
def logout():
    """Token bersifat stateless; klien menghapus token dari penyimpanan.

    Endpoint tetap disediakan agar alur UC-03 punya titik akhir eksplisit
    dan mudah dipindahkan ke mekanisme blacklist bila dibutuhkan.
    """
    return jsonify({"message": "Anda telah keluar dari sistem."})
