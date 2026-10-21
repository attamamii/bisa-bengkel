"""Helper validasi dan serialisasi untuk lapisan API."""

from decimal import Decimal, InvalidOperation

from flask import request

from .security import ApiError


def json_body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Format permintaan tidak valid. Kirim data JSON.", 400)
    return data


def require(data: dict, fields: list[tuple[str, str]]) -> None:
    """Pastikan field wajib terisi. `fields` berisi pasangan (nama, label)."""
    errors = {}
    for name, label in fields:
        value = data.get(name)
        if value is None or (isinstance(value, str) and not value.strip()):
            errors[name] = f"{label} wajib diisi."
    if errors:
        raise ApiError("Lengkapi data yang ditandai.", 400, errors)


def clean(value) -> str:
    return str(value or "").strip()


def as_int(value, field: str, minimum: int | None = None) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{field} harus berupa angka.", 400, {field: f"{field} harus berupa angka."})
    if minimum is not None and number < minimum:
        raise ApiError(
            f"{field} minimal {minimum}.", 400, {field: f"{field} minimal {minimum}."}
        )
    return number


def as_money(value, field: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ApiError(
            f"{field} harus berupa angka.", 400, {field: f"{field} harus berupa angka."}
        )
    if amount < 0:
        raise ApiError(
            f"{field} tidak boleh negatif.", 400, {field: f"{field} tidak boleh negatif."}
        )
    return amount.quantize(Decimal("0.01"))


def rupiah(value: float) -> str:
    """Format angka menjadi teks rupiah untuk nota dan pesan."""
    return "Rp " + f"{value:,.0f}".replace(",", ".")
