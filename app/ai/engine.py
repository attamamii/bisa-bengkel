"""Mesin diagnosis rule-based BISA (RF-04, RF-05).

Alur:
1. Normalisasi teks keluhan.
2. Cocokkan kata kunci pada katalog kerusakan dan hitung skor.
3. Ambil maksimal 3 kerusakan paling relevan.
4. Tarik harga sparepart & jasa dari master data.
5. Hitung rentang estimasi biaya.

Rentang dihitung dari subtotal dengan variasi wajar:
batas bawah 95% dan batas atas 115%, dibulatkan ke kelipatan Rp 5.000.
"""

import re
import unicodedata
from decimal import Decimal

from ..models import Part, Service
from .catalog import DAMAGE_CATALOG, FALLBACK_ENTRY, MANUAL_OPTIONS

MAX_MATCHES = 3
MIN_SCORE = 2
ROUNDING = Decimal("5000")


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return f" {text.strip()} "


def _keyword_hit(haystack: str, keyword: str) -> bool:
    """Kata kunci pendek wajib cocok sebagai kata utuh agar 'ac'
    tidak menangkap 'macet' atau 'baca'."""
    keyword = keyword.lower()
    if len(keyword) <= 3:
        return re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", haystack) is not None
    return keyword in haystack


def _score_entry(text: str, entry: dict) -> tuple[int, list[str]]:
    hits = [kw for kw in entry["keywords"] if _keyword_hit(text, kw)]
    score = sum(entry["keywords"][kw] for kw in hits)
    return score, hits


def _round_price(value: Decimal) -> Decimal:
    return (value / ROUNDING).quantize(Decimal("1")) * ROUNDING


def analyze(complaint: str, manual_code: str | None = None) -> dict:
    """Hasilkan analisis lengkap siap dikirim ke front-end."""
    text = _normalize(complaint)

    ranked = []
    for entry in DAMAGE_CATALOG:
        if manual_code and entry["code"] == manual_code:
            ranked.append((999, entry["name"].lower().split()[0], entry))
            continue
        score, hits = _score_entry(text, entry)
        if score >= MIN_SCORE:
            ranked.append((score, hits[0], entry))

    ranked.sort(key=lambda item: item[0], reverse=True)
    selected = [item[2] for item in ranked[:MAX_MATCHES]]
    confidence_map = {
        item[2]["code"]: min(96, 52 + min(item[0], 8) * 5) for item in ranked[:MAX_MATCHES]
    }

    fallback = False
    if not selected:
        fallback = True
        selected = [FALLBACK_ENTRY]
        confidence_map = {"INSPEKSI": 40}

    # --- Kumpulkan item unik -------------------------------------------------
    part_codes: list[str] = []
    service_codes: list[str] = []
    for entry in selected:
        for code in entry["parts"]:
            if code not in part_codes:
                part_codes.append(code)
        for code in entry["services"]:
            if code not in service_codes:
                service_codes.append(code)

    parts = Part.query.filter(Part.code.in_(part_codes)).all() if part_codes else []
    services = Service.query.filter(Service.code.in_(service_codes)).all() if service_codes else []
    parts_by_code = {p.code: p for p in parts}
    services_by_code = {s.code: s for s in services}

    items = []
    missing_prices = []
    subtotal = Decimal("0")

    for code in part_codes:
        part = parts_by_code.get(code)
        if not part:
            continue
        items.append(
            {
                "kind": "part",
                "code": part.code,
                "part_id": part.id,
                "name": part.name,
                "qty": 1,
                "unit_price": float(part.price),
                "price": float(part.price),
                "stock": part.stock,
                "available": part.stock > 0 and part.is_active,
            }
        )
        subtotal += Decimal(part.price)

    for code in service_codes:
        service = services_by_code.get(code)
        if not service:
            continue
        if float(service.price) <= 0:
            missing_prices.append(service.name)
        items.append(
            {
                "kind": "service",
                "code": service.code,
                "service_id": service.id,
                "name": service.name,
                "qty": 1,
                "unit_price": float(service.price),
                "price": float(service.price),
            }
        )
        subtotal += Decimal(service.price)

    if subtotal <= 0:
        estimate_min = Decimal("0")
        estimate_max = Decimal("0")
    else:
        estimate_min = _round_price(subtotal * Decimal("0.95"))
        estimate_max = _round_price(subtotal * Decimal("1.15"))

    damages = [
        {
            "code": entry["code"],
            "name": entry["name"],
            "severity": entry["severity"],
            "advice": entry["advice"],
            "confidence": confidence_map.get(entry["code"], 50),
        }
        for entry in selected
    ]

    summary = " · ".join(d["name"] for d in damages[:2])

    return {
        "complaint": complaint.strip(),
        "fallback": fallback,
        "summary": summary,
        "damages": damages,
        "items": items,
        "estimate_min": float(estimate_min),
        "estimate_max": float(estimate_max),
        "missing_prices": missing_prices,
        "manual_options": MANUAL_OPTIONS,
        "note": (
            "Hasil ini adalah estimasi awal berbasis teks keluhan, bukan vonis final. "
            "Mekanik tetap melakukan inspeksi langsung sebelum pengerjaan."
        ),
    }
