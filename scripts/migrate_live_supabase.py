import os
import sys
import psycopg2

def run_migration(connection_string: str, sql_file_path: str = "supabase_migration.sql"):
    print(f"Connecting to Supabase PostgreSQL...")
    try:
        conn = psycopg2.connect(connection_string)
        conn.autocommit = True
        cursor = conn.cursor()
        print("Connected successfully to Supabase!")

        print(f"Reading SQL script: {sql_file_path}")
        with open(sql_file_path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        print("Executing migration statements...")
        cursor.execute(sql_content)
        print("Migration executed successfully!")

        # Verify tables count
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = [r[0] for r in cursor.fetchall()]
        print(f"\nVerification: {len(tables)} tables verified in Supabase public schema:")
        for t in tables:
            cursor.execute(f'SELECT count(*) FROM "{t}";')
            cnt = cursor.fetchone()[0]
            print(f" - {t}: {cnt} rows")

        cursor.close()
        conn.close()
        print("\nAll data successfully migrated to Supabase!")
        return True
    except Exception as e:
        print(f"Error during migration: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        conn_str = sys.argv[1]
    else:
        conn_str = os.getenv("SUPABASE_DB_URL", "")

    if not conn_str:
        print("Usage: python scripts/migrate_live_supabase.py <SUPABASE_POSTGRES_CONNECTION_STRING>")
        print("Example: python scripts/migrate_live_supabase.py 'postgresql://postgres:YOUR_PASSWORD@db.fdxkpojbxmacjjlkillk.supabase.co:5432/postgres'")
        sys.exit(1)

    run_migration(conn_str)
