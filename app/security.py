"""Autentikasi JWT, hashing kata sandi, dan guard berbasis peran."""

from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from flask import current_app, g, jsonify, request

from .models import User


class ApiError(Exception):
    """Kesalahan API dengan status HTTP dan payload JSON yang konsisten."""

    def __init__(self, message: str, status: int = 400, fields: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.fields = fields or {}

    def to_response(self):
        payload = {"error": self.message}
        if self.fields:
            payload["fields"] = self.fields
        return jsonify(payload), self.status


def hash_password(raw: str) -> str:
    """Hashing kata sandi dengan Bcrypt (NFR-07)."""
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "name": user.name,
        "iat": now,
        "exp": now + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def _load_user_from_request() -> User | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None

    token = header[7:].strip()
    if not token:
        return None

    try:
        payload = jwt.decode(
            token, current_app.config["JWT_SECRET"], algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        raise ApiError("Sesi Anda sudah berakhir. Silakan login kembali.", 401)
    except jwt.InvalidTokenError:
        raise ApiError("Token tidak valid. Silakan login kembali.", 401)

    user = User.query.get(int(payload.get("sub", 0)))
    if not user or not user.is_active:
        raise ApiError("Akun tidak ditemukan atau sudah dinonaktifkan.", 401)
    return user


def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _load_user_from_request()
        if user is None:
            raise ApiError("Anda harus login untuk mengakses halaman ini.", 401)
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def roles_required(*roles: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None) or _load_user_from_request()
            if user is None:
                raise ApiError("Anda harus login untuk mengakses halaman ini.", 401)
            if user.role not in roles:
                raise ApiError("Anda tidak memiliki hak akses untuk aksi ini.", 403)
            g.current_user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def current_user() -> User:
    return g.current_user
