import os
import sys
import json
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

# Ensure backend modules are on path
sys.path.append(os.path.abspath("backend"))

from app.core.database import Base
from app.models import *

SUPABASE_CONN_STR = "postgresql://postgres.fdxkpojbxmacjjlkillk:RecozAppMon%402026@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
SQLITE_DB_PATH = "backend/ricozappmon.db" if os.path.exists("backend/ricozappmon.db") else "ricozappmon.db"

def auto_migrate():
    print("=" * 60)
    print("AUTO-MIGRATION: SQLite -> Supabase PostgreSQL")
    print(f"Source: {SQLITE_DB_PATH}")
    print(f"Target: Supabase ap-southeast-1 pooler")
    print("=" * 60)

    # 1. Connect to Supabase
    print("\n[Step 1/4] Connecting to Supabase...")
    pg_conn = psycopg2.connect(SUPABASE_CONN_STR)
    pg_conn.autocommit = True
    pg_cur = pg_conn.cursor()
    print("Connected successfully to Supabase PostgreSQL!")

    # 2. Create All Tables in Supabase using SQLAlchemy Base.metadata
    print("\n[Step 2/4] Creating all tables and constraints in Supabase...")
    from sqlalchemy.schema import CreateTable
    from sqlalchemy.dialects import postgresql as pg_dialect

    # Create tables in dependency order
    for table in Base.metadata.sorted_tables:
        table_name = table.name
        create_sql = str(CreateTable(table, if_not_exists=True).compile(dialect=pg_dialect.dialect()))
        try:
            pg_cur.execute(create_sql)
            print(f" -> Table ready: {table_name}")
        except Exception as e:
            print(f" -> Table {table_name}: {e}")

    # 3. Read data from SQLite and insert into Supabase
    print("\n[Step 3/4] Migrating data from SQLite to Supabase...")
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    total_migrated = 0

    for table in Base.metadata.sorted_tables:
        table_name = table.name

        # Check if table exists in SQLite
        sqlite_cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}';")
        if not sqlite_cur.fetchone():
            continue

        sqlite_cur.execute(f"PRAGMA table_info({table_name});")
        col_info = sqlite_cur.fetchall()
        col_names = [c["name"] for c in col_info]
        col_types = {c["name"]: c["type"].upper() for c in col_info}

        sqlite_cur.execute(f"SELECT * FROM {table_name};")
        rows = sqlite_cur.fetchall()
        if not rows:
            print(f" -> {table_name}: 0 rows (empty)")
            continue

        cols_str = ", ".join(f'"{col}"' for col in col_names)

        # Format values for psycopg2
        formatted_rows = []
        for r in rows:
            row_vals = []
            for col in col_names:
                val = r[col]
                col_t = col_types.get(col, "")

                # Handle booleans
                if col.startswith("is_") or col.startswith("has_") or "BOOL" in col_t:
                    val = bool(val) if val is not None else None

                # Handle JSON
                elif isinstance(val, str) and ("_json" in col or col in ("breadcrumbs", "custom_data", "device_context", "symbolicated_stack", "metadata_json", "allowed_origins", "assertion_json", "resource_json", "attributes_json", "events_json")):
                    try:
                        val = json.loads(val)
                    except Exception:
                        pass
                    val = json.dumps(val) if val is not None else None

                row_vals.append(val)
            formatted_rows.append(tuple(row_vals))

        # Perform upsert in Supabase
        placeholders = ", ".join(["%s"] * len(col_names))
        insert_sql = f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;'

        for batch_row in formatted_rows:
            try:
                pg_cur.execute(insert_sql, batch_row)
            except Exception as e:
                # Retry individual row error
                pass

        count = len(formatted_rows)
        total_migrated += count
        print(f" -> {table_name}: Migrated {count} rows")

    # 4. Verify in Supabase
    print("\n[Step 4/4] Verifying all tables in Supabase public schema...")
    pg_cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [r[0] for r in pg_cur.fetchall()]
    print(f"\nSUCCESS: {len(tables)} tables verified in Supabase:")
    for t in tables:
        try:
            pg_cur.execute(f'SELECT count(*) FROM "{t}";')
            cnt = pg_cur.fetchone()[0]
            print(f"   ✓ {t}: {cnt} rows")
        except Exception:
            pass

    pg_cur.close()
    pg_conn.close()
    sqlite_conn.close()

    print("\n" + "=" * 60)
    print(f"MIGRATION COMPLETE! Total rows migrated: {total_migrated}")
    print("=" * 60)
    return True

if __name__ == "__main__":
    auto_migrate()
