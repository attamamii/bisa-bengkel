-- Skema BISA untuk MariaDB/MySQL
-- Dibuat otomatis dari model SQLAlchemy. Jalankan setelah database `bisa` dibuat.

CREATE TABLE IF NOT EXISTS parts (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	code VARCHAR(24) NOT NULL, 
	name VARCHAR(140) NOT NULL, 
	category VARCHAR(60) NOT NULL, 
	unit VARCHAR(20) NOT NULL, 
	price NUMERIC(12, 2) NOT NULL, 
	stock INTEGER NOT NULL, 
	min_stock INTEGER NOT NULL, 
	is_active BOOL NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS services (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	code VARCHAR(24) NOT NULL, 
	name VARCHAR(140) NOT NULL, 
	category VARCHAR(60) NOT NULL, 
	price NUMERIC(12, 2) NOT NULL, 
	is_active BOOL NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(120) NOT NULL, 
	email VARCHAR(160) NOT NULL, 
	phone VARCHAR(24), 
	password_hash VARCHAR(255) NOT NULL, 
	`role` VARCHAR(16) NOT NULL, 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vehicles (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	plate_number VARCHAR(16) NOT NULL, 
	brand VARCHAR(60), 
	model VARCHAR(80), 
	year INTEGER, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_analyses (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	vehicle_id INTEGER, 
	complaint TEXT NOT NULL, 
	summary VARCHAR(255) NOT NULL, 
	estimate_min NUMERIC(12, 2) NOT NULL, 
	estimate_max NUMERIC(12, 2) NOT NULL, 
	payload TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(vehicle_id) REFERENCES vehicles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tickets (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	code VARCHAR(24) NOT NULL, 
	customer_id INTEGER NOT NULL, 
	vehicle_id INTEGER NOT NULL, 
	mechanic_id INTEGER, 
	complaint TEXT NOT NULL, 
	status VARCHAR(24) NOT NULL, 
	estimate_min NUMERIC(12, 2) NOT NULL, 
	estimate_max NUMERIC(12, 2) NOT NULL, 
	total_amount NUMERIC(12, 2) NOT NULL, 
	payment_method VARCHAR(16), 
	paid_at DATETIME, 
	invoice_number VARCHAR(32), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(customer_id) REFERENCES users (id), 
	FOREIGN KEY(vehicle_id) REFERENCES vehicles (id), 
	FOREIGN KEY(mechanic_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_events (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	ticket_id INTEGER NOT NULL, 
	actor_id INTEGER, 
	kind VARCHAR(24) NOT NULL, 
	message VARCHAR(255) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(ticket_id) REFERENCES tickets (id), 
	FOREIGN KEY(actor_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_items (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	ticket_id INTEGER NOT NULL, 
	kind VARCHAR(12) NOT NULL, 
	part_id INTEGER, 
	service_id INTEGER, 
	name VARCHAR(160) NOT NULL, 
	qty INTEGER NOT NULL, 
	unit_price NUMERIC(12, 2) NOT NULL, 
	source VARCHAR(12) NOT NULL, 
	approval_status VARCHAR(12) NOT NULL, 
	reason VARCHAR(255), 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(ticket_id) REFERENCES tickets (id), 
	FOREIGN KEY(part_id) REFERENCES parts (id), 
	FOREIGN KEY(service_id) REFERENCES services (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
