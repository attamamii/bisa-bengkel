"""Application factory BISA."""

from pathlib import Path

from flask import Flask, jsonify, render_template, request
from sqlalchemy.exc import SQLAlchemyError

from .config import PROJECT_ROOT, Config
from .extensions import db
from .security import ApiError


def create_app(config_class=Config) -> Flask:
    app = Flask(
        __name__,
        template_folder=str(PROJECT_ROOT / "templates"),
        static_folder=str(PROJECT_ROOT / "static"),
        static_url_path="/static",
    )
    app.config.from_object(config_class)

    db.init_app(app)

    from .api.admin import bp as admin_bp
    from .api.auth import bp as auth_bp
    from .api.customer import bp as customer_bp
    from .api.notifications import bp as notifications_bp
    from .api.tickets import bp as tickets_bp
    from .api.workshop import bp as workshop_bp
    from .openapi import register_docs

    app.register_blueprint(auth_bp)
    app.register_blueprint(customer_bp)
    app.register_blueprint(tickets_bp)
    app.register_blueprint(workshop_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(notifications_bp)

    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return error.to_response()

    @app.errorhandler(404)
    def handle_404(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Endpoint tidak ditemukan."}), 404
        return render_template("index.html"), 200

    @app.errorhandler(405)
    def handle_405(error):
        return jsonify({"error": "Metode HTTP tidak diizinkan."}), 405

    @app.errorhandler(500)
    def handle_500(error):
        db.session.rollback()
        if request.path.startswith("/api/"):
            return jsonify({"error": "Terjadi kesalahan pada server."}), 500
        return render_template("index.html"), 500

    @app.get("/api/health")
    def health():
        try:
            db.session.execute(db.text("SELECT 1"))
            database = "ok"
        except SQLAlchemyError:
            database = "unreachable"
        return jsonify(
            {
                "status": "ok",
                "database": database,
                "engine": Config.describe(),
            }
        )

    @app.get("/")
    def index():
        return render_template("index.html")

    register_docs(app)

    with app.app_context():
        _bootstrap_database(app)

    return app


def _bootstrap_database(app: Flask) -> None:
    """Buat tabel dan isi data demo saat basis data masih kosong."""
    from .models import User

    try:
        db.create_all()
    except SQLAlchemyError as exc:  # pragma: no cover - bergantung lingkungan
        app.logger.error("Gagal menyiapkan basis data: %s", exc)
        return

    if not app.config.get("AUTO_SEED", True):
        return

    try:
        if User.query.count() == 0:
            from .seed import seed_all

            seed_all()
            app.logger.info("Data demo BISA berhasil dimuat.")
    except SQLAlchemyError as exc:  # pragma: no cover
        db.session.rollback()
        app.logger.error("Gagal memuat data demo: %s", exc)
