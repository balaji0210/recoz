import os
import sys
import json
import sqlite3
from datetime import datetime

# Table insertion order respecting foreign keys
TABLE_ORDER = [
    "users",
    "teams",
    "memberships",
    "notification_channels",
    "applications",
    "rum_sessions",
    "rum_events",
    "error_groups",
    "error_events",
    "source_maps",
    "spans",
    "trace_summaries",
    "alert_rules",
    "incidents",
    "synthetic_checks",
    "synthetic_steps",
    "synthetic_results",
    "notification_logs"
]

def format_pg_value(val, col_type=""):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, str):
        # Escape single quotes
        escaped = val.replace("'", "''")
        return f"'{escaped}'"
    if isinstance(val, (dict, list)):
        escaped = json.dumps(val).replace("'", "''")
        return f"'{escaped}'::jsonb"
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"

def dump_sqlite_to_supabase_sql(sqlite_path: str, output_sql_path: str):
    print(f"Reading SQLite database from: {sqlite_path}")
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get available tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    existing_tables = set(r[0] for r in cursor.fetchall())
    print(f"Found {len(existing_tables)} tables in SQLite database.")

    # Tables to dump in order
    tables_to_dump = [t for t in TABLE_ORDER if t in existing_tables]
    for t in existing_tables:
        if t not in tables_to_dump:
            tables_to_dump.append(t)

    sql_lines = [
        "-- ==========================================================================",
        "-- RICOZ APM - SUPABASE POSTGRESQL MIGRATION",
        f"-- Generated at: {datetime.utcnow().isoformat()}Z",
        "-- Project Ref: fdxkpojbxmacjjlkillk",
        "-- ==========================================================================",
        "",
        "-- Enable necessary extensions",
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";",
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
        "",
        "-- Drop tables in reverse order for clean idempotency if needed",
        "/*",
    ]
    for t in reversed(tables_to_dump):
        sql_lines.append(f"DROP TABLE IF EXISTS {t} CASCADE;")
    sql_lines.extend([
        "*/",
        "",
        "-- ----------------- TABLE SCHEMAS -----------------",
        """
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memberships (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(32) DEFAULT 'engineer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_channels (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    channel_type VARCHAR(32) NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tier VARCHAR(32) DEFAULT 'production',
    ingest_key_hash VARCHAR(255) NOT NULL,
    ingest_key_prefix VARCHAR(32) NOT NULL,
    allowed_origins JSONB DEFAULT '["*"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rum_sessions (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    session_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    user_metadata JSONB DEFAULT '{}'::jsonb,
    browser VARCHAR(64),
    browser_version VARCHAR(32),
    os VARCHAR(64),
    device VARCHAR(32),
    country VARCHAR(8),
    ip_address VARCHAR(45),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_seconds DOUBLE PRECISION DEFAULT 0.0,
    is_bounce BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rum_events (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    session_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    url TEXT NOT NULL,
    route VARCHAR(255),
    referrer TEXT,
    duration DOUBLE PRECISION,
    status_code INTEGER,
    cls DOUBLE PRECISION,
    lcp DOUBLE PRECISION,
    fid DOUBLE PRECISION,
    inp DOUBLE PRECISION,
    ttfb DOUBLE PRECISION,
    fcp DOUBLE PRECISION,
    interaction_target VARCHAR(255),
    error_message TEXT,
    error_stack TEXT,
    trace_id VARCHAR(32),
    span_id VARCHAR(16),
    custom_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_groups (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    fingerprint VARCHAR(64) NOT NULL,
    error_type VARCHAR(128) NOT NULL,
    message_template TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'unhandled',
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    affected_users_count INTEGER DEFAULT 1,
    last_release VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_events (
    id VARCHAR(36) PRIMARY KEY,
    error_group_id VARCHAR(36) NOT NULL REFERENCES error_groups(id) ON DELETE CASCADE,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    session_id VARCHAR(64),
    trace_id VARCHAR(32),
    raw_stack_trace TEXT,
    symbolicated_stack_trace JSONB,
    breadcrumbs JSONB DEFAULT '[]'::jsonb,
    device_context JSONB DEFAULT '{}'::jsonb,
    release_version VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_maps (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    release_version VARCHAR(64) NOT NULL,
    minified_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spans (
    id VARCHAR(36) PRIMARY KEY,
    trace_id VARCHAR(32) NOT NULL,
    span_id VARCHAR(16) NOT NULL,
    parent_span_id VARCHAR(16),
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    service_name VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(32) DEFAULT 'internal',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms DOUBLE PRECISION NOT NULL,
    status_code VARCHAR(32) DEFAULT 'UNSET',
    status_message TEXT,
    attributes_json JSONB DEFAULT '{}'::jsonb,
    events_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trace_summaries (
    id VARCHAR(36) PRIMARY KEY,
    trace_id VARCHAR(32) UNIQUE NOT NULL,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    root_service_name VARCHAR(128) NOT NULL,
    root_operation_name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms DOUBLE PRECISION NOT NULL,
    span_count INTEGER DEFAULT 1,
    error_count INTEGER DEFAULT 0,
    has_errors BOOLEAN DEFAULT FALSE,
    http_status INTEGER,
    http_method VARCHAR(16),
    http_route VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(64) NOT NULL,
    operator VARCHAR(16) NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    duration_seconds INTEGER DEFAULT 60,
    severity VARCHAR(32) DEFAULT 'warning',
    state VARCHAR(32) DEFAULT 'OK',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(36) PRIMARY KEY,
    alert_rule_id VARCHAR(36) REFERENCES alert_rules(id) ON DELETE SET NULL,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    dedup_key VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'OPEN',
    current_value DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS synthetic_checks (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    check_type VARCHAR(32) DEFAULT 'http',
    url TEXT NOT NULL,
    method VARCHAR(16) DEFAULT 'GET',
    headers_json JSONB DEFAULT '{}'::jsonb,
    body_text TEXT,
    expected_status INTEGER DEFAULT 200,
    json_assertion TEXT,
    latency_sla_ms DOUBLE PRECISION DEFAULT 500.0,
    interval_seconds INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS synthetic_steps (
    id VARCHAR(36) PRIMARY KEY,
    synthetic_check_id VARCHAR(36) NOT NULL REFERENCES synthetic_checks(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    action VARCHAR(64) NOT NULL,
    selector TEXT,
    value TEXT,
    timeout_ms INTEGER DEFAULT 5000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS synthetic_results (
    id VARCHAR(36) PRIMARY KEY,
    synthetic_check_id VARCHAR(36) NOT NULL REFERENCES synthetic_checks(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    http_status INTEGER,
    dns_time_ms DOUBLE PRECISION DEFAULT 0.0,
    tcp_time_ms DOUBLE PRECISION DEFAULT 0.0,
    tls_time_ms DOUBLE PRECISION DEFAULT 0.0,
    ttfb_ms DOUBLE PRECISION DEFAULT 0.0,
    download_time_ms DOUBLE PRECISION DEFAULT 0.0,
    total_duration_ms DOUBLE PRECISION NOT NULL,
    error_message TEXT,
    assertion_results JSONB DEFAULT '[]'::jsonb,
    response_snippet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id VARCHAR(36) PRIMARY KEY,
    incident_id VARCHAR(36) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    notification_channel_id VARCHAR(36) NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    payload_json JSONB DEFAULT '{}'::jsonb,
    response_code INTEGER,
    response_body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
        """
    ])

    # Indexes
    sql_lines.extend([
        "-- ----------------- PERFORMANCE INDEXES -----------------",
        "CREATE INDEX IF NOT EXISTS idx_rum_events_app_created ON rum_events(application_id, created_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_rum_sessions_app_last_active ON rum_sessions(application_id, last_active_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);",
        "CREATE INDEX IF NOT EXISTS idx_spans_app_start_time ON spans(application_id, start_time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_error_events_group_created ON error_events(error_group_id, created_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_synthetic_results_check ON synthetic_results(synthetic_check_id, created_at DESC);",
        ""
    ])

    # Now dump data for each table
    sql_lines.append("-- ----------------- DATA MIGRATION -----------------")
    total_rows = 0

    for table in tables_to_dump:
        cursor.execute(f"PRAGMA table_info({table});")
        col_info = cursor.fetchall()
        col_names = [c["name"] for c in col_info]
        col_types = {c["name"]: c["type"].upper() for c in col_info}

        cursor.execute(f"SELECT * FROM {table};")
        rows = cursor.fetchall()
        count = len(rows)
        total_rows += count
        sql_lines.append(f"\n-- Data for table: {table} ({count} rows)")

        if count == 0:
            continue

        cols_str = ", ".join(f'"{col}"' for col in col_names)
        
        # Batch insert for performance
        batch_size = 50
        for i in range(0, count, batch_size):
            batch = rows[i:i + batch_size]
            values_clauses = []
            for r in batch:
                row_vals = []
                for col in col_names:
                    val = r[col]
                    col_t = col_types.get(col, "")
                    # Auto parse json strings if column name ends in _json or similar
                    if isinstance(val, str) and ("_json" in col or col in ("breadcrumbs", "custom_data", "device_context", "symbolicated_stack_trace", "user_metadata", "allowed_origins", "assertion_results")):
                        try:
                            val = json.loads(val)
                        except Exception:
                            pass
                    row_vals.append(format_pg_value(val, col_t))
                values_clauses.append(f"({', '.join(row_vals)})")

            insert_stmt = f"INSERT INTO {table} ({cols_str}) VALUES\n  " + ",\n  ".join(values_clauses) + "\nON CONFLICT DO NOTHING;"
            sql_lines.append(insert_stmt)

    with open(output_sql_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))

    print(f"\nMigration SQL successfully generated!")
    print(f"File: {output_sql_path}")
    print(f"Total Tables: {len(tables_to_dump)}")
    print(f"Total Rows Migrated: {total_rows}")
    return total_rows

if __name__ == "__main__":
    db_path = "backend/ricozappmon.db" if os.path.exists("backend/ricozappmon.db") else "ricozappmon.db"
    out_path = "supabase_migration.sql"
    dump_sqlite_to_supabase_sql(db_path, out_path)
