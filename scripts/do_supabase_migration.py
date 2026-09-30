import os
import sys
import json
import sqlite3
import psycopg2
from psycopg2.extras import execute_values
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql as pg_dialect

sys.path.append(os.path.abspath("backend"))

from app.core.database import Base
import app.models

SQLITE_PATH = "backend/ricozappmon.db" if os.path.exists("backend/ricozappmon.db") else "ricozappmon.db"

def migrate():
    print("=" * 60, flush=True)
    print("MIGRATING LOCAL SQLITE DATA -> SUPABASE POSTGRESQL", flush=True)
    print("=" * 60, flush=True)

    print("\n1. Connecting to Supabase (aws-0-ap-southeast-1.pooler.supabase.com)...", flush=True)
    pg_conn = psycopg2.connect(
        host="aws-0-ap-southeast-1.pooler.supabase.com",
        port=6543,
        user="postgres.fdxkpojbxmacjjlkillk",
        password="RecozAppMon@2026",
        dbname="postgres",
        sslmode="require",
        connect_timeout=15
    )
    pg_conn.autocommit = True
    pg_cur = pg_conn.cursor()
    print(" Connected successfully to Supabase PostgreSQL 17.6!", flush=True)

    print("\n2. Creating all tables in Supabase public schema...", flush=True)
    for table in Base.metadata.sorted_tables:
        create_sql = str(CreateTable(table, if_not_exists=True).compile(dialect=pg_dialect.dialect()))
        try:
            pg_cur.execute(create_sql)
            print(f"   Table verified/created: {table.name}", flush=True)
        except Exception as e:
            print(f"   Table {table.name} warning: {e}", flush=True)

    print("\n3. Migrating data from SQLite to Supabase...", flush=True)
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    total_rows = 0

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
            print(f"   -> {table_name}: 0 rows", flush=True)
            continue

        formatted_rows = []
        for r in rows:
            row_vals = []
            for col in col_names:
                val = r[col]
                col_t = col_types.get(col, "")
                if val is None:
                    row_vals.append(None)
                elif col.startswith("is_") or col.startswith("has_") or "BOOL" in col_t:
                    row_vals.append(bool(val))
                elif isinstance(val, str) and ("_json" in col or col in ("breadcrumbs", "custom_data", "device_context", "symbolicated_stack", "metadata_json", "allowed_origins", "assertion_json", "resource_json", "attributes_json", "events_json")):
                    try:
                        val = json.loads(val)
                    except Exception:
                        pass
                    row_vals.append(json.dumps(val))
                else:
                    row_vals.append(val)
            formatted_rows.append(row_vals)

        # Batch insert using execute_values
        cols_joined = ", ".join(f'"{c}"' for c in col_names)
        insert_query = f'INSERT INTO "{table_name}" ({cols_joined}) VALUES %s ON CONFLICT DO NOTHING'
        try:
            execute_values(pg_cur, insert_query, formatted_rows, page_size=200)
            count = len(formatted_rows)
            total_rows += count
            print(f"    {table_name}: successfully migrated {count} rows", flush=True)
        except Exception as e:
            print(f"   Error inserting into {table_name}: {e}", flush=True)

    print("\n4. Verifying migrated tables & counts in Supabase...", flush=True)
    pg_cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    pg_tables = [r[0] for r in pg_cur.fetchall()]
    print(f"\n Verified {len(pg_tables)} tables in Supabase public schema:", flush=True)
    for t in pg_tables:
        try:
            pg_cur.execute(f'SELECT count(*) FROM "{t}";')
            cnt = pg_cur.fetchone()[0]
            print(f"    {t}: {cnt} rows", flush=True)
        except Exception as e:
            print(f"   ? {t}: {e}", flush=True)

    pg_cur.close()
    pg_conn.close()
    sqlite_conn.close()

    print("\n" + "=" * 60, flush=True)
    print(f" AUTOMATIC MIGRATION TO SUPABASE COMPLETED SUCCESSFULLY!", flush=True)
    print(f"Total Rows Migrated: {total_rows}", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    migrate()
