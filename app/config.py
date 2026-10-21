"""Konfigurasi aplikasi BISA.

Satu sumber kebenaran untuk koneksi basis data, JWT, dan opsi runtime.
Basis data default mengikuti SRS (MariaDB/MySQL), namun bisa dialihkan
ke SQLite lewat DB_ENGINE=sqlite agar pengembangan tidak bergantung
pada server database yang sedang berjalan.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")


def _database_uri() -> str:
    explicit = os.getenv("DATABASE_URL", "").strip()
    if explicit:
        return explicit

    engine = os.getenv("DB_ENGINE", "mysql").strip().lower()
    if engine == "sqlite":
        return f"sqlite:///{(PROJECT_ROOT / 'bisa.db').as_posix()}"

    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "3306")
    name = os.getenv("DB_NAME", "bisa")
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "bisa-dev-secret-key")
    JWT_SECRET = os.getenv("JWT_SECRET", SECRET_KEY)
    JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "12"))

    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}

    AUTO_SEED = os.getenv("AUTO_SEED", "true").strip().lower() in {"1", "true", "yes"}
    JSON_SORT_KEYS = False

    # Batas percobaan login sebelum form dikunci sementara (UC-02).
    LOGIN_MAX_ATTEMPTS = 5
    LOGIN_LOCK_SECONDS = 60

    @staticmethod
    def describe() -> str:
        uri = _database_uri()
        if uri.startswith("sqlite"):
            return f"SQLite ({uri.rsplit('/', 1)[-1]})"
        tail = uri.split("@")[-1]
        return f"MariaDB/MySQL ({tail})"
