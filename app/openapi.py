"""Dokumentasi API otomatis (NFR-14).

Spesifikasi OpenAPI 3.0 dibangun langsung dari `app.url_map`, sehingga setiap
endpoint baru otomatis ikut terdokumentasi tanpa perlu menulis ulang daftar
manual. Ringkasan tiap operasi diambil dari docstring view function-nya.

Akses:
- `GET /api/openapi.json` — spesifikasi mentah (bisa diimpor ke Postman).
- `GET /api/docs`         — Swagger UI yang membaca spesifikasi di atas.
"""

import re
from typing import Any

from flask import jsonify, render_template_string

TAGS = {
    "auth": "Autentikasi (RF-01, RF-02, RF-03)",
    "customer": "Sisi Customer (RF-04, RF-05, RF-16)",
    "tickets": "Tiket & Approval (RF-06, RF-10, RF-15)",
    "workshop": "Sisi Mekanik (RF-07, RF-08, RF-09)",
    "admin": "Sisi Admin (RF-11, RF-12, RF-13, RF-17)",
    "notifications": "Notifikasi near-real-time (RF-09)",
}

# Parameter kueri yang tidak bisa ditebak dari aturan URL.
QUERY_PARAMS: dict[str, list[dict[str, Any]]] = {
    "/api/notifications": [
        {
            "name": "after",
            "in": "query",
            "required": False,
            "schema": {"type": "integer", "minimum": 0, "default": 0},
            "description": "Kursor id peristiwa terakhir yang sudah diterima klien.",
        }
    ],
    "/api/admin/dashboard": [
        {
            "name": "period",
            "in": "query",
            "required": False,
            "schema": {"type": "string", "enum": ["today", "week", "month"], "default": "today"},
            "description": "Rentang laporan pendapatan (RF-17).",
        }
    ],
    "/api/admin/dashboard/export.csv": [
        {
            "name": "period",
            "in": "query",
            "required": False,
            "schema": {"type": "string", "enum": ["today", "week", "month"], "default": "today"},
            "description": "Rentang laporan yang diekspor.",
        }
    ],
    "/api/tickets": [
        {
            "name": "status",
            "in": "query",
            "required": False,
            "schema": {
                "type": "string",
                "enum": ["menunggu", "dikerjakan", "selesai_pengerjaan", "selesai", "dibatalkan"],
            },
            "description": "Filter status tiket.",
        },
        {
            "name": "scope",
            "in": "query",
            "required": False,
            "schema": {"type": "string", "enum": ["mine"]},
            "description": "Khusus mekanik: hanya tiket yang sedang ia kerjakan.",
        },
    ],
    "/api/admin/parts": [
        {"name": "q", "in": "query", "schema": {"type": "string"}, "description": "Pencarian nama/kode/kategori."}
    ],
    "/api/workshop/catalog/parts": [
        {"name": "q", "in": "query", "schema": {"type": "string"}, "description": "Pencarian sparepart."}
    ],
    "/api/workshop/catalog/services": [
        {"name": "q", "in": "query", "schema": {"type": "string"}, "description": "Pencarian jasa."}
    ],
}

PUBLIC_ENDPOINTS = {
    "auth.register",
    "auth.login",
    "health",
    "openapi_spec",
    "api_docs",
}

PATH_PARAM_RE = re.compile(r"<(?:([a-zA-Z_]+):)?([a-zA-Z_]+)>")

def _tags_for(endpoint: str) -> list[str]:
    name = endpoint.split(".")[0]
    return [name] if name in TAGS else [name]

def _convert_path(rule_text: str) -> tuple[str, list[dict[str, Any]]]:
    """Ubah `/api/admin/parts/<int:part_id>` menjadi `/api/admin/parts/{part_id}`."""
    params: list[dict[str, Any]] = []

    def repl(match: re.Match) -> str:
        converter, name = match.group(1), match.group(2)
        schema = {"type": "integer"} if converter == "int" else {"type": "string"}
        params.append(
            {
                "name": name,
                "in": "path",
                "required": True,
                "schema": schema,
                "description": f"Parameter path `{name}`.",
            }
        )
        return "{" + name + "}"

    return PATH_PARAM_RE.sub(repl, rule_text), params

def _first_line(doc: str | None) -> str:
    if not doc:
        return ""
    for line in doc.strip().splitlines():
        line = line.strip()
        if line:
            return line
    return ""

def build_spec(app) -> dict:
    paths: dict[str, dict] = {}

    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        if not rule.rule.startswith("/api"):
            continue
        if rule.endpoint == "static":
            continue

        view = app.view_functions.get(rule.endpoint)
        if view is None:
            continue

        path, path_params = _convert_path(rule.rule)
        doc = (view.__doc__ or "").strip()
        secured = rule.endpoint not in PUBLIC_ENDPOINTS and hasattr(view, "__wrapped__")

        for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            operation: dict[str, Any] = {
                "tags": _tags_for(rule.endpoint),
                "summary": _first_line(doc) or rule.endpoint,
                "description": doc or None,
                "operationId": f"{rule.endpoint}_{method.lower()}",
                "parameters": path_params + QUERY_PARAMS.get(rule.rule, []),
                "responses": {
                    "200": {"description": "Berhasil.", "content": {"application/json": {}}},
                    "400": {
                        "description": "Validasi gagal.",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
                    },
                    "401": {
                        "description": "Token tidak ada/kedaluwarsa.",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
                    },
                    "403": {
                        "description": "Peran pengguna tidak berhak.",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
                    },
                },
                "security": [{"bearerAuth": []}] if secured else [],
            }
            if method in {"POST", "PUT", "PATCH"}:
                operation["requestBody"] = {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"type": "object", "additionalProperties": True}}
                    },
                }
            paths.setdefault(path, {})[method.lower()] = operation

    return {
        "openapi": "3.0.3",
        "info": {
            "title": "BISA — Bengkel Integrated Service Application API",
            "version": "1.0.0",
            "description": (
                "Dokumentasi REST API sistem BISA. Seluruh pertukaran data memakai JSON "
                "(NFR-15) dan rute terlindungi memakai bearer JWT (NFR-06).\n\n"
                "Alur demonstrasi: login → analisis keluhan → buat tiket → mekanik klaim & "
                "ajukan tambahan → customer menyetujui → kasir membayar → nota digital."
            ),
        },
        "servers": [{"url": "/", "description": "Server aplikasi"}],
        "tags": [{"name": name, "description": desc} for name, desc in TAGS.items()],
        "paths": paths,
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "Tempelkan token hasil `POST /api/auth/login`.",
                }
            },
            "schemas": {
                "Error": {
                    "type": "object",
                    "properties": {
                        "error": {"type": "string", "example": "Email atau kata sandi tidak cocok."},
                        "fields": {"type": "object", "additionalProperties": {"type": "string"}},
                    },
                }
            },
        },
    }

SWAGGER_PAGE = """<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BISA API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #FFFDF5; font-family: system-ui, sans-serif; }
    .docs-bar {
      display: flex; align-items: center; gap: 12px; padding: 14px 20px;
      background: #FFD93D; border-bottom: 4px solid #000; font-weight: 800;
    }
    .docs-bar a { color: #000; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div class="docs-bar">
    <span>BISA API Docs</span>
    <a href="/api/openapi.json" download>openapi.json</a>
    <a href="/">← aplikasi</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true,
      docExpansion: "none",
      defaultModelsExpandDepth: 0,
    });
  </script>
</body>
</html>
"""

def register_docs(app) -> None:
    @app.get("/api/openapi.json")
    def openapi_spec():
        """Spesifikasi OpenAPI 3.0 seluruh endpoint BISA (NFR-14)."""
        response = jsonify(build_spec(app))
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/docs")
    def api_docs():
        """Swagger UI untuk menjelajahi dan mencoba endpoint (NFR-14)."""
        return render_template_string(SWAGGER_PAGE)
