"""Menghasilkan DDL MariaDB/MySQL dari model SQLAlchemy (temporary helper)."""

import os

os.environ["DB_ENGINE"] = "sqlite"

from sqlalchemy.dialects import mysql
from sqlalchemy.schema import CreateTable

from app import create_app
from app.extensions import db

app = create_app()
with app.app_context():
    out = []
    for table in db.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=mysql.dialect())).strip()
        ddl = ddl.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1)
        ddl = ddl.rstrip().rstrip(";") + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
        out.append(ddl)

with open("schema_mysql.sql", "w", encoding="utf-8") as fh:
    fh.write(
        "-- Skema BISA untuk MariaDB/MySQL\n"
        "-- Dibuat otomatis dari model SQLAlchemy. Jalankan setelah database `bisa` dibuat.\n\n"
        + "\n\n".join(out)
        + "\n"
    )
print("schema_mysql.sql dibuat:", len(out), "tabel")
