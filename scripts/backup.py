"""Backup harian basis data BISA (NFR-13).

SRS mewajibkan auto-backup setiap 23:59 WITA. Skrip ini hanya melakukan
*pekerjaan* backup-nya; penjadwalan diserahkan ke Task Scheduler Windows
(lihat `scripts/register_backup_task.ps1`).

Contoh pakai:
    python scripts/backup.py                 # backup + simpan 14 arsip terakhir
    python scripts/backup.py --keep 30       # simpan 30 arsip
    python scripts/backup.py --list          # lihat daftar arsip

Hasil disimpan di `backups/bisa-YYYYmmdd-HHMMSS.sql.gz`.
- SQLite  : memakai API backup sqlite3 (aman walau aplikasi sedang jalan).
- MariaDB : memakai `mysqldump --single-transaction` (konsisten tanpa lock).
"""

from __future__ import annotations

import argparse
import gzip
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.config import Config, PROJECT_ROOT as ROOT, _database_uri  # noqa: E402

BACKUP_DIR = ROOT / "backups"
WITA = timedelta(hours=8)


def _timestamp() -> str:
    return (datetime.now(timezone.utc) + WITA).strftime("%Y%m%d-%H%M%S")


def _sqlite_path() -> Path:
    uri = _database_uri()
    if not uri.startswith("sqlite"):
        raise RuntimeError("Basis data aktif bukan SQLite.")
    raw = uri.split("sqlite:///", 1)[-1]
    return Path(raw)


def backup_sqlite() -> Path:
    source = _sqlite_path()
    if not source.exists():
        raise FileNotFoundError(f"Basis data SQLite tidak ditemukan: {source}")

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    target = BACKUP_DIR / f"bisa-{_timestamp()}.sql.gz"

    with tempfile.TemporaryDirectory() as tmp:
        snapshot = Path(tmp) / "bisa-snapshot.db"
        src = sqlite3.connect(source)
        dst = sqlite3.connect(snapshot)
        try:
            src.backup(dst)  # API resmi, aman untuk DB yang sedang dipakai
        finally:
            dst.close()
            src.close()
        with open(snapshot, "rb") as raw, gzip.open(target, "wb") as gz:
            shutil.copyfileobj(raw, gz)
    return target


def backup_mysql() -> Path:
    uri = _database_uri()
    dump = shutil.which("mysqldump")
    if not dump:
        raise RuntimeError(
            "mysqldump tidak ditemukan di PATH. Install MariaDB/MySQL client "
            "atau jalankan backup dari server basis data."
        )

    # mysql+pymysql://user:pass@host:port/db?charset=utf8mb4
    body = uri.split("://", 1)[1]
    credentials, tail = body.rsplit("@", 1)
    user, _, password = credentials.partition(":")
    hostport, _, rest = tail.partition("/")
    database = rest.split("?", 1)[0]
    host, _, port = hostport.partition(":")

    command = [
        dump,
        f"--host={host or '127.0.0.1'}",
        f"--port={port or '3306'}",
        f"--user={user or 'root'}",
        "--single-transaction",
        "--routines",
        "--triggers",
        "--default-character-set=utf8mb4",
        database,
    ]
    env = dict(os.environ)
    if password:
        env["MYSQL_PWD"] = password  # hindari password terlihat di daftar proses

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    target = BACKUP_DIR / f"bisa-{_timestamp()}.sql.gz"

    with gzip.open(target, "wb") as gz:
        result = subprocess.run(command, stdout=gz, stderr=subprocess.PIPE, env=env)
    if result.returncode != 0:
        target.unlink(missing_ok=True)
        raise RuntimeError(
            "mysqldump gagal: " + result.stderr.decode("utf-8", "replace").strip()
        )
    return target


def prune(keep: int) -> list[Path]:
    archives = sorted(BACKUP_DIR.glob("bisa-*.sql.gz"), key=lambda p: p.stat().st_mtime)
    removed = []
    for old in archives[:-keep] if keep > 0 else []:
        old.unlink(missing_ok=True)
        removed.append(old)
    return removed


def list_archives() -> list[Path]:
    if not BACKUP_DIR.exists():
        return []
    return sorted(BACKUP_DIR.glob("bisa-*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup basis data BISA (NFR-13).")
    parser.add_argument("--keep", type=int, default=14, help="Jumlah arsip yang disimpan (default 14).")
    parser.add_argument("--list", action="store_true", help="Tampilkan daftar arsip lalu keluar.")
    args = parser.parse_args()

    if args.list:
        archives = list_archives()
        if not archives:
            print("Belum ada arsip backup.")
        for path in archives:
            size_kb = path.stat().st_size / 1024
            print(f"{path.name}  ({size_kb:.1f} KB)")
        return 0

    engine = Config.describe()
    try:
        target = backup_mysql() if "MariaDB" in engine else backup_sqlite()
    except Exception as exc:  # noqa: BLE001 - pesan jelas untuk operator
        print(f"[GAGAL] {exc}", file=sys.stderr)
        return 1

    removed = prune(args.keep)
    print(f"[OK] {engine} -> {target.relative_to(ROOT)} ({target.stat().st_size / 1024:.1f} KB)")
    if removed:
        print(f"[OK] {len(removed)} arsip lama dihapus (menyisakan {args.keep}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
