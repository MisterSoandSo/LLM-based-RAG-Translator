import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "glossary.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # --- Base table setup ---
    cur.execute("""
    CREATE TABLE IF NOT EXISTS glossary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chinese TEXT NOT NULL,
        english TEXT NOT NULL,
        notes TEXT,
        UNIQUE(chinese, english)
    );
    """)

    # --- Migration tracking ---
    cur.execute("""
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY
    );
    """)

    # Get current version (0 if new)
    cur.execute("SELECT MAX(version) FROM schema_migrations;")
    version = cur.fetchone()[0] or 0

    # --- Apply migrations incrementally ---
    if version < 1:
        print("Applying migration v1: add timestamps...")

        # Add columns (no default because SQLite restricts it)
        cur.execute("ALTER TABLE glossary ADD COLUMN created_at DATETIME;")
        cur.execute("ALTER TABLE glossary ADD COLUMN updated_at DATETIME;")

        # Backfill existing rows with timestamps
        cur.execute("UPDATE glossary SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;")
        cur.execute("UPDATE glossary SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;")

        # Add triggers to auto-update updated_at
        cur.executescript("""
        CREATE TRIGGER IF NOT EXISTS set_created_at
        AFTER INSERT ON glossary
        FOR EACH ROW
        WHEN NEW.created_at IS NULL
        BEGIN
            UPDATE glossary SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS set_updated_at
        AFTER UPDATE ON glossary
        FOR EACH ROW
        BEGIN
            UPDATE glossary SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        """)

        cur.execute("INSERT INTO schema_migrations (version) VALUES (1);")


    # Future migrations go here
    if version < 2:
        pass

    conn.commit()
    conn.close()
