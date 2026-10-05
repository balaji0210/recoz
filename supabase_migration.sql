-- ==========================================================================
-- RICOZ APM - SUPABASE POSTGRESQL MIGRATION
-- Generated at: 2026-09-30T11:45:45.956262Z
-- Project Ref: fdxkpojbxmacjjlkillk
-- ==========================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop tables in reverse order for clean idempotency if needed
/*
DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS synthetic_results CASCADE;
DROP TABLE IF EXISTS synthetic_steps CASCADE;
DROP TABLE IF EXISTS synthetic_checks CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS trace_summaries CASCADE;
DROP TABLE IF EXISTS spans CASCADE;
DROP TABLE IF EXISTS source_maps CASCADE;
DROP TABLE IF EXISTS error_events CASCADE;
DROP TABLE IF EXISTS error_groups CASCADE;
DROP TABLE IF EXISTS rum_events CASCADE;
DROP TABLE IF EXISTS rum_sessions CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS notification_channels CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;
*/

-- ----------------- TABLE SCHEMAS -----------------

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
        
-- ----------------- PERFORMANCE INDEXES -----------------
CREATE INDEX IF NOT EXISTS idx_rum_events_app_created ON rum_events(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rum_sessions_app_last_active ON rum_sessions(application_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_app_start_time ON spans(application_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_group_created ON error_events(error_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_synthetic_results_check ON synthetic_results(synthetic_check_id, created_at DESC);

-- ----------------- DATA MIGRATION -----------------

-- Data for table: users (1 rows)
INSERT INTO users ("id", "email", "name", "hashed_password", "is_active", "is_superuser", "created_at", "updated_at") VALUES
  ('3737abce-29fa-44d8-ad70-082efbdf028f', 'admin@ricozappmon.io', 'Admin User', '214ee58e4f55a591c3588215a8e54e81$bf8c355a7dd3f46fddf65a3b0a7dfcd6af9da4775449cbe8017c288fd01e8496', TRUE, TRUE, '2026-09-21 10:49:07.775895', '2026-09-21 10:49:07.775899')
ON CONFLICT DO NOTHING;

-- Data for table: teams (1 rows)
INSERT INTO teams ("id", "name", "slug", "created_at") VALUES
  ('495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'Engineering Core', 'engineering-core', '2026-09-21 10:49:07.780917')
ON CONFLICT DO NOTHING;

-- Data for table: memberships (1 rows)
INSERT INTO memberships ("id", "user_id", "team_id", "role", "created_at") VALUES
  ('f0279e0b-df1f-43ab-8f58-6919254b9d15', '3737abce-29fa-44d8-ad70-082efbdf028f', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'admin', '2026-09-21 10:49:07.786789')
ON CONFLICT DO NOTHING;

-- Data for table: notification_channels (1 rows)
INSERT INTO notification_channels ("id", "team_id", "name", "channel_type", "config_json", "is_active", "created_at") VALUES
  ('526be059-8e39-44dd-85c5-ad76a1ed4f72', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'DevOps Slack & Email Webhook', 'webhook', '{"webhook_url": "http://localhost:8000/api/v1/stats/health"}'::jsonb, TRUE, '2026-09-21 10:49:07.793329')
ON CONFLICT DO NOTHING;

-- Data for table: applications (1 rows)
INSERT INTO applications ("id", "team_id", "name", "slug", "tier", "environment", "ingest_key_hash", "ingest_key_prefix", "allowed_origins", "is_active", "created_at", "updated_at") VALUES
  ('demo-ecommerce-app-id', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'ShopSphere E-Commerce Web', 'shopsphere-web', 'agent', 'production', 'c4e1059b575201c3d06a81a53d92dc765fbedfe4337b9bfde6e97fd21a874a8c', 'rz_live_lFe7...', '["*"]'::jsonb, TRUE, '2026-09-21 10:49:07.784524', '2026-09-21 10:49:07.784528')
ON CONFLICT DO NOTHING;

-- Data for table: rum_sessions (4 rows)
INSERT INTO rum_sessions ("id", "application_id", "session_id", "user_id", "user_agent", "browser", "os", "device", "ip_address", "started_at", "last_active_at", "page_views_count", "errors_count", "duration_seconds") VALUES
  ('sess_93ad6fe23c07', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'usr_958', NULL, 'Firefox 124', 'Windows 11', 'Tablet', NULL, '2026-09-29 11:50:20.817658', '2026-09-29 11:57:20.817658', 0, 0, 0.0),
  ('sess_6e5fb9b721dc', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'usr_995', NULL, 'Firefox 124', 'Android 14', 'Tablet', NULL, '2026-09-29 11:32:30.325418', '2026-09-29 11:57:30.325418', 0, 0, 0.0),
  ('sess_2b3d88319a43', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'usr_838', NULL, 'Firefox 124', 'Windows 11', 'Mobile', NULL, '2026-09-29 11:45:30.655503', '2026-09-29 11:57:30.655503', 0, 0, 0.0),
  ('sess_c337b2df7d88', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'usr_169', NULL, 'Safari 17', 'Windows 11', 'Tablet', NULL, '2026-09-29 12:00:48.611567', '2026-09-29 12:12:48.611567', 0, 0, 0.0)
ON CONFLICT DO NOTHING;

-- Data for table: rum_events (44 rows)
INSERT INTO rum_events ("id", "application_id", "session_id", "event_type", "url", "route", "duration", "status_code", "lcp", "inp", "cls", "ttfb", "fcp", "fid", "trace_id", "span_id", "metadata_json", "created_at") VALUES
  ('ev_63845ab996d2', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 315.145331136153, NULL, 2112.07716140711, 118.7834798063956, 0.058867613041151914, 124.64293860802901, 692.1901294169775, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:49:20.817658'),
  ('ev_fd3c6f4ddd9d', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 423.38536039669793, NULL, 1651.7335833787074, 58.782707406466216, 0.0384763357641621, 224.5294508116378, 300.83209917660844, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:53:20.817658'),
  ('ev_6cd65d70c767', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/products/item-492', '/products/item-492', 246.67501738786024, NULL, 953.8187904018773, 40.66358551453707, 0.05289912088280384, 242.77418350051076, 290.02555790993097, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:53:20.817658'),
  ('ev_bf34bf4e8e48', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/products', '/products', 302.64743999374906, NULL, 1015.3406701864055, 41.62213985510893, 0.025718537842519977, 161.37473782738292, 632.3544885606262, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:48:20.817658'),
  ('ev_b1f03ccd724d', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/', '/', 208.62828307241773, NULL, 974.2696070337108, 102.55293443193852, 0.04886762654188278, 124.26225860008034, 671.449451796575, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:44:20.817658'),
  ('ev_56c37918ee8f', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/checkout', '/checkout', 581.0387829670833, NULL, 902.3941178697062, 97.55167736189067, 0.025088834814659747, 214.2978668146261, 736.1322773094398, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:48:20.817658'),
  ('ev_bff7ddf33483', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/cart', '/cart', 586.75708922126, NULL, 1587.6390727419255, 70.87082504218756, 0.04890656101306052, 70.47786390392392, 718.5677351826612, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:42:20.817658'),
  ('ev_d98cafefd96e', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/products', '/products', 339.6176926428285, NULL, 1259.458764946075, 47.22150855384228, 0.05514755812463787, 121.57271315662311, 632.6305364960788, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:50:20.817658'),
  ('ev_cf866ddddd99', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/', '/', 631.7821612172825, NULL, 924.7009943808689, 58.513558886531406, 0.059625739639300956, 99.79834258828856, 543.7316733109253, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:50:20.817658'),
  ('ev_4c8955279b8d', 'demo-ecommerce-app-id', 'sess_93ad6fe23c07', 'page_view', 'https://shopsphere.io/cart', '/cart', 435.2194213131151, NULL, 2171.5011162824185, 146.20671063114577, 0.016121106024523563, 116.61962219495072, 575.8448821922038, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:57:20.817658'),
  ('ev_fb312d09f6a1', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/', '/', 287.9691195406476, NULL, 812.0245314497104, 53.82079443617098, 0.04902086806016053, 97.88320085372416, 398.04405329624103, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:52:30.325418'),
  ('ev_ac9eabc4e92b', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/products', '/products', 328.15837370333657, NULL, 2160.69648399969, 123.50256677370533, 0.046779171789546804, 252.68791209064995, 481.9888742769175, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:44:30.325418'),
  ('ev_b495e648bf02', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/products', '/products', 333.9898933740641, NULL, 1856.4575991057036, 143.4492923139141, 0.05692005495673583, 95.9204934016273, 652.5432472645609, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:53:30.325418'),
  ('ev_1c7dba7637d4', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/products/item-492', '/products/item-492', 462.8956794486036, NULL, 1488.9324690091207, 113.09826268494194, 0.05134409180083271, 205.58924461161374, 382.09578125215944, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:45:30.325418'),
  ('ev_8d9649084b6b', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/cart', '/cart', 440.10177123039244, NULL, 1796.6536001544678, 133.0719818128728, 0.05433845936618394, 95.2543104536724, 468.61303209239145, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:42:30.325418'),
  ('ev_73c44e0b3152', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 400.45026342444413, NULL, 850.2646246537263, 148.8311570111076, 0.043635877316680845, 78.86582207694015, 642.4640700106711, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:56:30.325418'),
  ('ev_9204b835952e', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 512.0946714395286, NULL, 1059.1044822570389, 65.70651611289836, 0.022886005028291745, 257.9251773530698, 553.4778046363721, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:54:30.325418'),
  ('ev_9c4bc99980f6', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 677.9159941439443, NULL, 1478.2700145629046, 73.851743490138, 0.057005822172629894, 120.4176621856857, 743.7779729039014, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:50:30.325418'),
  ('ev_c0f91f6b371b', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/cart', '/cart', 399.2503928796369, NULL, 1670.6054709185355, 152.7844111207026, 0.04650670362567622, 121.99241227762829, 328.64625075062173, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:54:30.325418'),
  ('ev_6855056ce2d9', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/products', '/products', 355.3856446144665, NULL, 2020.5259157041276, 159.16339280710218, 0.02828842202537222, 80.13601008942356, 634.4068995863806, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:43:30.325418'),
  ('ev_dfd43926e461', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/products', '/products', 687.6236196112662, NULL, 843.9118058859904, 106.48064088602999, 0.05516847104861728, 88.15359928413363, 485.5290215445408, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:54:30.325418'),
  ('ev_23c1aee059d1', 'demo-ecommerce-app-id', 'sess_6e5fb9b721dc', 'page_view', 'https://shopsphere.io/cart', '/cart', 647.1038995511669, NULL, 1948.0687063690245, 64.8545067569715, 0.05676077776860446, 271.4588126386446, 417.90502452267117, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:48:30.325418'),
  ('ev_1bb6892dc2ec', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/cart', '/cart', 731.8343381204412, NULL, 1992.706237515139, 115.66783785492385, 0.02503181602081104, 131.02649379882556, 273.59094370986185, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:46:30.655503'),
  ('ev_b40be03632f2', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/products', '/products', 228.0880043781658, NULL, 904.6729241162867, 135.26943404811152, 0.03197930397486001, 222.44239787648897, 364.3265786520855, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:51:30.655503'),
  ('ev_4dee493afe8a', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 728.8383919457818, NULL, 1489.3954372929556, 121.64570803631813, 0.04540848862226489, 144.54000325496696, 653.9410751056404, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:57:30.655503'),
  ('ev_9599203b42cb', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/products', '/products', 852.1221029768835, NULL, 1029.0753169509026, 152.2824995975675, 0.05805066399784016, 172.23653333179902, 767.2672427368, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:53:30.655503'),
  ('ev_fc92ffaa1dbc', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/products/item-492', '/products/item-492', 582.6155508289935, NULL, 1834.2410895126552, 127.21200630035892, 0.04807569567558802, 190.72334669429333, 285.0469742887432, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:53:30.655503'),
  ('ev_db2117dbf493', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/cart', '/cart', 594.4226120005997, NULL, 1500.013886625712, 73.10064603766767, 0.012010623153090767, 200.68196983719653, 413.8162049919084, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:47:30.655503'),
  ('ev_208531b4d6c2', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/products/item-492', '/products/item-492', 742.998692997719, NULL, 1820.7010542359972, 80.91231630274928, 0.04976838320825275, 112.04281093487683, 756.7691999735225, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:50:30.655503'),
  ('ev_7e5a881880e7', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/products/item-492', '/products/item-492', 202.951050057185, NULL, 1985.7396278041663, 131.3484723659435, 0.05353864029062813, 261.3665742391754, 423.61564531588823, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:49:30.655503'),
  ('ev_114cdda7335e', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/products/item-492', '/products/item-492', 867.8249092480999, NULL, 1394.9369013091273, 98.05962952791815, 0.05833423142264357, 87.9001584775448, 452.6447619144168, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:48:30.655503'),
  ('ev_d113fe4c663b', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/checkout', '/checkout', 893.1978707793223, NULL, 1533.756867317009, 84.4194754439212, 0.022434506849519194, 277.7278396244466, 632.4651538070625, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:49:30.655503'),
  ('ev_5ab1d2dab8b0', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 152.61529421395704, NULL, 1566.843062515039, 95.51799221062092, 0.021176772843506005, 145.11416956111657, 439.1231372378528, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:46:30.655503'),
  ('ev_5a7968587f96', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/checkout', '/checkout', 643.1832441922313, NULL, 2141.197341912933, 47.70669027864275, 0.011897744239064863, 152.75839332801252, 409.0425224918989, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:57:30.655503'),
  ('ev_d1620392e25a', 'demo-ecommerce-app-id', 'sess_2b3d88319a43', 'page_view', 'https://shopsphere.io/', '/', 833.1972053038398, NULL, 902.3941401224295, 96.55151019306933, 0.04407804221209805, 198.8821291068418, 730.3463929729846, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 11:51:30.655503'),
  ('ev_3ce8c40a15bb', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/products/item-492', '/products/item-492', 569.5803364209684, NULL, 2100.4093582243586, 52.00129225256538, 0.047506263283708265, 139.52526253591924, 789.575978005229, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:09:48.611567'),
  ('ev_0b7c92d35a85', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/checkout', '/checkout', 944.7637841887604, NULL, 819.8785681150789, 75.07022837893436, 0.022663460334966613, 201.9908809682312, 487.781935307446, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:09:48.611567'),
  ('ev_bd476fb118a3', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/', '/', 523.07976033621, NULL, 2142.479252963824, 76.81538413272628, 0.013922195852707571, 149.0847176411972, 637.6899413212741, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:04:48.611567'),
  ('ev_85f1c493fab4', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/cart', '/cart', 709.5054262551255, NULL, 839.040049862747, 43.69582241822315, 0.03815413412256784, 194.30304189131556, 489.07693953887474, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:02:48.611567'),
  ('ev_a20528985a8b', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/products', '/products', 397.82693925330136, NULL, 1504.8708017876406, 40.17801386888244, 0.04086309283646406, 87.65828950316634, 799.9315166812773, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:09:48.611567'),
  ('ev_a2031039cb7e', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 467.4712268529162, NULL, 1016.9496087187326, 147.70724175234466, 0.05015891211040704, 173.79527225710507, 693.2323988026043, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:10:48.611567'),
  ('ev_e5835a398e56', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 637.9037254490677, NULL, 1456.962299857952, 152.94871579982774, 0.019035870162210984, 220.59200848070833, 281.20021790261467, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:03:48.611567'),
  ('ev_ea11998ec687', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/account/orders', '/account/orders', 392.0999550121201, NULL, 928.4443777057076, 133.0523812980409, 0.022590222079897884, 103.51195166540326, 601.4853391055183, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:03:48.611567'),
  ('ev_6a3c13d6efbd', 'demo-ecommerce-app-id', 'sess_c337b2df7d88', 'page_view', 'https://shopsphere.io/checkout', '/checkout', 890.2602813197414, NULL, 1988.0677996676047, 59.436352413235156, 0.039582064891804734, 219.50790116641565, 268.87428932955714, NULL, NULL, NULL, '{}'::jsonb, '2026-09-29 12:05:48.611567')
ON CONFLICT DO NOTHING;

-- Data for table: error_groups (3 rows)
INSERT INTO error_groups ("id", "application_id", "fingerprint", "error_type", "message_template", "status", "first_seen", "last_seen", "occurrence_count", "affected_users_count", "last_release") VALUES
  ('err-1', 'demo-ecommerce-app-id', 'a89f21000000', 'TypeError', 'Cannot read properties of undefined (reading ''price'')', 'unhandled', '2026-09-27T11:19:38.450537+00:00', '2026-09-28T11:19:38.450516+00:00', 42, 19, '1.2.4'),
  ('err-2', 'demo-ecommerce-app-id', '4d1290000000', 'NetworkError', 'Failed to fetch resource from CDN payment gateway', 'resolved', '2026-09-27T11:19:38.450537+00:00', '2026-09-28T11:19:38.450516+00:00', 14, 11, '1.2.4'),
  ('err-3', 'demo-ecommerce-app-id', 'bc4471000000', 'ReferenceError', 'StripeCheckoutHandler is not defined', 'resolved', '2026-09-27T11:19:38.450537+00:00', '2026-09-28T11:19:38.450516+00:00', 8, 5, '1.2.3')
ON CONFLICT DO NOTHING;

-- Data for table: error_events (0 rows)

-- Data for table: source_maps (0 rows)

-- Data for table: spans (8 rows)
INSERT INTO spans ("id", "trace_id", "span_id", "parent_span_id", "application_id", "service_name", "name", "kind", "start_time", "end_time", "duration_ms", "status_code", "status_message", "attributes_json", "events_json", "resource_json", "created_at") VALUES
  ('sp_f670ff9b2483', '638c9413b8d346d9bfcf0d7d749045ba', 'cd7ff71d88754754', NULL, 'demo-ecommerce-app-id', 'frontend-web', 'User Action: Page Navigation', 'client', '2026-09-29 11:57:18.817658', '2026-09-29 11:57:20.817658', 210.5, 'OK', NULL, '{"http.route": "/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 11:57:20.817658'),
  ('sp_87b2cf5b3a2e', '638c9413b8d346d9bfcf0d7d749045ba', 'e720c34c74ae47f2', 'cd7ff71d88754754', 'demo-ecommerce-app-id', 'node-gateway', 'POST /api/checkout', 'server', '2026-09-29 11:57:19.017658', '2026-09-29 11:57:20.817658', 180.2, 'OK', NULL, '{"http.route": "/api/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 11:57:20.817658'),
  ('sp_da1f786bd902', '77e2c0fcc1d6417790ae02fffb33f738', '18f46ef9d5e34db9', NULL, 'demo-ecommerce-app-id', 'frontend-web', 'User Action: Page Navigation', 'client', '2026-09-29 11:57:28.325418', '2026-09-29 11:57:30.325418', 210.5, 'OK', NULL, '{"http.route": "/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 11:57:30.325418'),
  ('sp_cd98e312b16e', '77e2c0fcc1d6417790ae02fffb33f738', '1c694d17200b4e1f', '18f46ef9d5e34db9', 'demo-ecommerce-app-id', 'node-gateway', 'POST /api/checkout', 'server', '2026-09-29 11:57:28.525418', '2026-09-29 11:57:30.325418', 180.2, 'OK', NULL, '{"http.route": "/api/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 11:57:30.325418'),
  ('sp_6e9c109b71aa', 'b679e8fae71b4ee5ba91d3435ea52818', 'f89c2629b7204e90', NULL, 'demo-ecommerce-app-id', 'frontend-web', 'User Action: Page Navigation', 'client', '2026-09-29 11:57:28.655503', '2026-09-29 11:57:30.655503', 210.5, 'OK', NULL, '{"http.route": "/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 11:57:30.655503'),
  ('sp_e40f50c57a0d', 'b679e8fae71b4ee5ba91d3435ea52818', 'd889950c84724ba6', 'f89c2629b7204e90', 'demo-ecommerce-app-id', 'node-gateway', 'POST /api/checkout', 'server', '2026-09-29 11:57:28.855503', '2026-09-29 11:57:30.655503', 180.2, 'OK', NULL, '{"http.route": "/api/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 11:57:30.655503'),
  ('sp_388af5f8608d', 'f260335db98f4758a28991f601b718e1', 'bda738c312e64e7a', NULL, 'demo-ecommerce-app-id', 'frontend-web', 'User Action: Page Navigation', 'client', '2026-09-29 12:12:46.611567', '2026-09-29 12:12:48.611567', 210.5, 'OK', NULL, '{"http.route": "/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 12:12:48.611567'),
  ('sp_81971e7c7dee', 'f260335db98f4758a28991f601b718e1', '17de01a6197b40a8', 'bda738c312e64e7a', 'demo-ecommerce-app-id', 'node-gateway', 'POST /api/checkout', 'server', '2026-09-29 12:12:46.811567', '2026-09-29 12:12:48.611567', 180.2, 'OK', NULL, '{"http.route": "/api/checkout", "http.status": 200}'::jsonb, '[]'::jsonb, '{}'::jsonb, '2026-09-29 12:12:48.611567')
ON CONFLICT DO NOTHING;

-- Data for table: trace_summaries (0 rows)

-- Data for table: alert_rules (2 rows)
INSERT INTO alert_rules ("id", "application_id", "team_id", "name", "metric_type", "operator", "threshold", "duration_seconds", "severity", "state", "pending_since", "is_active", "created_at") VALUES
  ('50c3ab5f-8d89-4465-a174-6a1a90d1086e', 'demo-ecommerce-app-id', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'High JS Error Rate (> 5%)', 'error_rate', 'gt', 5.0, 60, 'critical', 'OK', NULL, TRUE, '2026-09-21 10:49:07.790293'),
  ('31af9b9f-37de-4f95-8975-ee35c1573714', 'demo-ecommerce-app-id', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'Slow P95 Page Load (> 2500ms)', 'p95_latency', 'gt', 2500.0, 120, 'warning', 'OK', NULL, TRUE, '2026-09-21 10:49:07.790301')
ON CONFLICT DO NOTHING;

-- Data for table: incidents (2 rows)
INSERT INTO incidents ("id", "alert_rule_id", "application_id", "team_id", "dedup_key", "title", "severity", "status", "current_value", "threshold", "triggered_at", "acknowledged_at", "resolved_at", "acknowledged_by_user_id") VALUES
  ('inc-1', '31af9b9f-37de-4f95-8975-ee35c1573714', 'demo-ecommerce-app-id', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', '31af9b9f-37de-4f95-8975-ee35c1573714_init', 'Alert: High JS Error Rate breached (6.8% > 5.0%)', 'critical', 'RESOLVED', 6.8, 5.0, '2026-09-28T10:52:35.516950+00:00', '2026-09-28 12:15:57.167274', '2026-09-28 12:15:57.189028', '3737abce-29fa-44d8-ad70-082efbdf028f'),
  ('inc-2', '50c3ab5f-8d89-4465-a174-6a1a90d1086e', 'demo-ecommerce-app-id', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', '50c3ab5f-8d89-4465-a174-6a1a90d1086e_init', 'Alert: Slow P95 Page Load breached (2840ms > 2500ms)', 'warning', 'RESOLVED', 1940.0, 2500.0, '2026-09-28T09:52:35.519392+00:00', NULL, '2026-09-28T10:22:35.519419+00:00', NULL)
ON CONFLICT DO NOTHING;

-- Data for table: synthetic_checks (2 rows)
INSERT INTO synthetic_checks ("id", "application_id", "team_id", "name", "check_type", "url", "method", "headers_json", "body", "expected_status", "json_assertion", "latency_sla_ms", "interval_seconds", "timeout_seconds", "retry_count", "status", "uptime_percent", "last_run_at", "is_active", "created_at") VALUES
  ('7002ab09-d6f4-4182-929f-6fc0564d0cad', 'demo-ecommerce-app-id', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'Checkout API Gateway Health', 'http', 'http://localhost:8000/api/v1/stats/health', 'GET', '{}'::jsonb, NULL, 200, 'status=healthy', 500.0, 60, 15, 2, 'HEALTHY', 100.0, '2026-09-30 09:54:53.119263', TRUE, '2026-09-21 10:49:07.796084'),
  ('0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'demo-ecommerce-app-id', '495dcdcb-f33a-4077-8fcf-aee3b4686b14', 'Auth Verification Probe API', 'http', 'http://localhost:8000/api/v1/stats/health', 'GET', '{}'::jsonb, NULL, 200, NULL, 500.0, 60, 15, 2, 'HEALTHY', 100.0, '2026-09-30 09:54:53.119263', TRUE, '2026-09-29 17:22:12.181664')
ON CONFLICT DO NOTHING;

-- Data for table: synthetic_steps (0 rows)

-- Data for table: synthetic_results (538 rows)
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('87082936-1038-40be-b93c-53319f79debc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 404.84, 5.0, 12.0, 18.0, 161.94, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1.2}', '2026-09-21 10:49:07.801397'),
  ('2c93319c-4845-49d3-b554-054136c3634b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 358.13, 5.0, 12.0, 18.0, 143.25, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":61.6}', '2026-09-21 10:50:08.287103'),
  ('a545d5da-7d45-4f8d-a913-113ffd61887c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.01, 5.0, 12.0, 18.0, 106.81, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":122.0}', '2026-09-21 10:51:08.756963'),
  ('7aa81bd0-c454-41d5-a65b-b2cff099f49a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.18, 5.0, 12.0, 18.0, 107.67, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":182.3}', '2026-09-21 10:52:09.071300'),
  ('e97b08c4-0881-47f1-8351-3689262649ce', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.71, 5.0, 12.0, 18.0, 107.88, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":242.7}', '2026-09-21 10:53:09.408606'),
  ('80f907b3-17c2-461c-845a-7c0584460f7f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.73, 5.0, 12.0, 18.0, 106.69, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":303.0}', '2026-09-21 10:54:09.730672'),
  ('ba4972bc-9deb-4565-b9f9-9050534ff2f1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.79, 5.0, 12.0, 18.0, 107.52, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":363.3}', '2026-09-21 10:55:10.055791'),
  ('fb68c222-d3e6-4f2e-8fa7-dacb82887537', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.95, 5.0, 12.0, 18.0, 107.58, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":423.7}', '2026-09-21 10:56:10.378306'),
  ('e7794f43-f9ea-4ec2-aedd-9b5330e47477', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.99, 5.0, 12.0, 18.0, 108.4, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":484.0}', '2026-09-21 10:57:10.707240'),
  ('f7bc7c3a-aa38-47b6-9d93-e0da2054ede3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 345.57, 5.0, 12.0, 18.0, 138.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":544.4}', '2026-09-21 10:58:11.031100'),
  ('00b296ae-685a-4af0-9e75-5d4441a2bbfa', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 273.65, 5.0, 12.0, 18.0, 109.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":604.7}', '2026-09-21 10:59:11.444303'),
  ('2331ec0d-ded3-4c76-b7d0-0886a48c3f6d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.23, 5.0, 12.0, 18.0, 108.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":665.1}', '2026-09-21 11:00:11.784157'),
  ('d43cfde2-3a0d-4cb0-bb11-307404e3bba6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 313.96, 5.0, 12.0, 18.0, 125.59, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":725.4}', '2026-09-21 11:01:12.122449'),
  ('535bfc94-77f1-44c7-8dc1-24b4b88ff5ef', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 305.78, 5.0, 12.0, 18.0, 122.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":785.9}', '2026-09-21 11:02:12.602320'),
  ('c6cf2c73-4260-4639-beb4-e2d44b9b4908', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 347.05, 5.0, 12.0, 18.0, 138.82, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":846.4}', '2026-09-21 11:03:13.045424'),
  ('e7ccdcba-e74c-4c57-9418-fa7e86940eff', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 375.47, 5.0, 12.0, 18.0, 150.17, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":906.9}', '2026-09-21 11:04:13.532347'),
  ('f7d6c83e-8d81-4ac8-8013-537cf81ac720', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 292.07, 5.0, 12.0, 18.0, 116.83, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":967.3}', '2026-09-21 11:05:14.041490'),
  ('4487e190-bf2e-4fcf-b846-8ee03b363e70', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 286.69, 5.0, 12.0, 18.0, 114.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1027.7}', '2026-09-21 11:06:14.438791'),
  ('8931f0ce-0c65-4b31-b49b-0e251da3118d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 290.55, 5.0, 12.0, 18.0, 116.22, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1088.2}', '2026-09-21 11:07:14.890772'),
  ('1b7ff0bc-1e3c-4294-84a2-fbc222637e98', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 317.77, 5.0, 12.0, 18.0, 127.11, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1148.6}', '2026-09-21 11:08:15.291287'),
  ('e9f51895-2059-4dcb-8421-cd3627a2bd8e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 290.12, 5.0, 12.0, 18.0, 116.05, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1209.1}', '2026-09-21 11:09:15.799353'),
  ('bba41467-1e59-4853-bdc7-873907f03b27', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 369.12, 5.0, 12.0, 18.0, 147.65, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1269.6}', '2026-09-21 11:10:16.213290'),
  ('04c23e9c-0eb2-405e-910b-4c035b7c0fe2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 292.23, 5.0, 12.0, 18.0, 116.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1330.0}', '2026-09-21 11:11:16.697794'),
  ('8866158c-87b9-4c28-a441-fbc757a0588f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 294.37, 5.0, 12.0, 18.0, 117.75, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1390.4}', '2026-09-21 11:12:17.120115'),
  ('c8513829-5943-4e22-becd-b3913492d861', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 306.81, 5.0, 12.0, 18.0, 122.73, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1450.9}', '2026-09-21 11:13:17.557940'),
  ('00221457-3be3-4727-b3d1-868f7f27bd61', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 289.43, 5.0, 12.0, 18.0, 115.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1511.3}', '2026-09-21 11:14:18.003675'),
  ('d74734e4-def1-4896-8ebf-b38bd831474d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 321.54, 5.0, 12.0, 18.0, 128.62, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1571.7}', '2026-09-21 11:15:18.392742'),
  ('dea0bf87-cfef-439f-b269-948b7f3d5e6a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 291.78, 5.0, 12.0, 18.0, 116.71, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1632.2}', '2026-09-21 11:16:18.849372'),
  ('17b500e4-c952-4651-b1b6-bfdfc2286a30', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 312.65, 5.0, 12.0, 18.0, 125.06, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1692.6}', '2026-09-21 11:17:19.244083'),
  ('ecc34a29-af68-4f84-b918-ea94169abcf0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 392.74, 5.0, 12.0, 18.0, 157.1, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1753.1}', '2026-09-21 11:18:19.664050'),
  ('02a50852-a5da-443c-9d3f-633cc1ca1629', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 369.97, 5.0, 12.0, 18.0, 147.99, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1813.6}', '2026-09-21 11:19:20.191434'),
  ('1dea2c66-bdc5-4487-bae1-60426180bf89', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 283.12, 5.0, 12.0, 18.0, 113.25, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1874.0}', '2026-09-21 11:20:20.694695'),
  ('569767f9-fedb-4dbd-9761-72f542e06a6c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 288.21, 5.0, 12.0, 18.0, 115.28, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1934.4}', '2026-09-21 11:21:21.076549'),
  ('9ad737a5-a700-447b-b98d-f46ec80ea752', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 284.18, 5.0, 12.0, 18.0, 113.67, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1994.7}', '2026-09-21 11:22:21.447861'),
  ('1bd8da1b-c727-4857-b236-5ec891c4a7ce', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 337.66, 5.0, 12.0, 18.0, 135.06, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2055.2}', '2026-09-21 11:23:21.895216'),
  ('338e53a9-c9c6-4b25-9cda-05b85d48e6a9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 322.41, 5.0, 12.0, 18.0, 128.97, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2115.7}', '2026-09-21 11:24:22.407867'),
  ('be1f90f0-7d57-42b8-a309-38abcecdd342', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 303.11, 5.0, 12.0, 18.0, 121.24, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2176.3}', '2026-09-21 11:25:22.963761'),
  ('86139d78-83d9-4999-bd1f-fedd5bd21895', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 401.15, 5.0, 12.0, 18.0, 160.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2236.8}', '2026-09-21 11:26:23.399829'),
  ('9fc0e6ee-a748-4b17-beb8-b9c7590190cf', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 377.94, 5.0, 12.0, 18.0, 151.18, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2297.4}', '2026-09-21 11:27:23.978117'),
  ('375afcc0-6527-4be1-ad87-20427ee4403f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 313.03, 5.0, 12.0, 18.0, 125.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2357.8}', '2026-09-21 11:28:24.467354'),
  ('c9a41414-b72e-4705-81d4-ca6aafd75d57', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 449.21, 5.0, 12.0, 18.0, 179.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2418.3}', '2026-09-21 11:29:24.897096'),
  ('679e32b4-325d-4efb-8cc9-9fc2efb6dd04', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 287.24, 5.0, 12.0, 18.0, 114.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2478.8}', '2026-09-21 11:30:25.522247'),
  ('8643f8e5-0f2c-4fd8-a487-108b8f91c420', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 347.07, 5.0, 12.0, 18.0, 138.83, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2539.3}', '2026-09-21 11:31:25.932233'),
  ('e8f9ad2b-de8c-46de-821c-1e4bbb5cd082', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 496.14, 5.0, 12.0, 18.0, 198.45, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2600.0}', '2026-09-21 11:32:26.459242'),
  ('296db251-fb4b-4392-8363-444628c1193d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 710.53, 5.0, 12.0, 18.0, 284.2, 'Duration 710.5ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2660.8}', '2026-09-21 11:33:27.145341'),
  ('688e34eb-7e6c-4a3f-bc23-fe0376f338b9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 295.39, 5.0, 12.0, 18.0, 118.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2721.4}', '2026-09-21 11:34:28.139257'),
  ('d5c1116b-62a7-41a9-a12d-b26688a9b303', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 284.12, 5.0, 12.0, 18.0, 113.65, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2782.1}', '2026-09-21 11:35:28.781699'),
  ('dccd2494-5cf5-4c55-b28d-53f1abd84db3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 297.73, 5.0, 12.0, 18.0, 119.09, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2842.5}', '2026-09-21 11:36:29.156270'),
  ('e31add96-4ba2-4d07-a0fe-d520ee81f5b4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 375.28, 5.0, 12.0, 18.0, 150.1, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2903.2}', '2026-09-21 11:37:29.796748'),
  ('dadd8d85-dbc3-42a8-87f2-90ea2030c4af', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 296.36, 5.0, 12.0, 18.0, 118.55, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2963.6}', '2026-09-21 11:38:30.280430')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('9de4fa0d-0f2b-4fbd-bb35-8a8903c156f4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 288.41, 5.0, 12.0, 18.0, 115.36, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3024.0}', '2026-09-21 11:39:30.683735'),
  ('e18d0b57-835c-4b23-aa74-53dedfd5614b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 365.84, 5.0, 12.0, 18.0, 146.33, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3084.4}', '2026-09-21 11:40:31.065565'),
  ('b02939bb-7b52-44a5-8e31-915036a13d0c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 324.05, 5.0, 12.0, 18.0, 129.62, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3423.0}', '2026-09-21 11:46:09.658786'),
  ('1089b03f-1165-4fdb-9905-60575b1f4ccd', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 3061.84, 5.0, 12.0, 18.0, 1224.72, 'Duration 3061.8ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":5774.3}', '2026-09-21 12:25:17.611374'),
  ('71468367-04a1-4025-8ca2-03102fdced82', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 392.85, 5.0, 12.0, 18.0, 157.13, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":5835.2}', '2026-09-21 12:26:21.795761'),
  ('ebfe1a63-d3fa-4aa9-919d-5a1498bbdee0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 288.99, 5.0, 12.0, 18.0, 115.6, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":5895.6}', '2026-09-21 12:27:22.263795'),
  ('d1c5165a-b856-403c-b8e5-942a4a5552bc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.82, 5.0, 12.0, 18.0, 107.53, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":5955.9}', '2026-09-21 12:28:22.619277'),
  ('a12284c9-e769-4a55-a528-73ca3b9a9d45', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.52, 5.0, 12.0, 18.0, 108.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6016.2}', '2026-09-21 12:29:22.950654'),
  ('d427e3b8-d16c-4ed7-9ccd-5c37caec31eb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 297.66, 5.0, 12.0, 18.0, 119.07, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6076.6}', '2026-09-21 12:30:23.289196'),
  ('60d0c61f-62ce-4d46-84b8-7b9e576ec5f7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.36, 5.0, 12.0, 18.0, 107.34, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6136.9}', '2026-09-21 12:31:23.650698'),
  ('ee195cf8-c029-4a8d-939d-e42580770d17', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.64, 5.0, 12.0, 18.0, 108.66, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6197.3}', '2026-09-21 12:32:23.982238'),
  ('964ba3b7-28b4-43c1-a8e0-138e11a9ddc6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.14, 5.0, 12.0, 18.0, 108.06, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6257.6}', '2026-09-21 12:33:24.314373'),
  ('29966c3c-da42-4eea-b3a3-1ebae551757b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.09, 5.0, 12.0, 18.0, 108.44, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6317.9}', '2026-09-21 12:34:24.633617'),
  ('d15b2049-579e-4c06-ad6b-9a7de50593d0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.29, 5.0, 12.0, 18.0, 108.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6378.3}', '2026-09-21 12:35:24.975885'),
  ('c41ec4d5-7e66-4d59-965b-78eb71847570', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.07, 5.0, 12.0, 18.0, 108.43, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6438.6}', '2026-09-21 12:36:25.309278'),
  ('bfe9b3fe-c6dd-458d-8b90-c0a3a983af03', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 284.3, 5.0, 12.0, 18.0, 113.72, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6498.9}', '2026-09-21 12:37:25.647894'),
  ('e47878eb-c02f-45fd-941b-69ea446e3c07', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.05, 5.0, 12.0, 18.0, 108.02, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6559.3}', '2026-09-21 12:38:25.999420'),
  ('11e90366-8dd6-40ef-8657-fd058c565bef', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 290.42, 5.0, 12.0, 18.0, 116.17, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6619.6}', '2026-09-21 12:39:26.325360'),
  ('4b44a24b-bb0a-4bdd-a825-661b368e9f2b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.24, 5.0, 12.0, 18.0, 108.5, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6680.0}', '2026-09-21 12:40:26.682941'),
  ('8af3bbd1-2d7f-4c93-87fb-c32527d52e43', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.03, 5.0, 12.0, 18.0, 107.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6740.3}', '2026-09-21 12:41:27.031433'),
  ('18a225dd-b7c2-4a98-bd36-299e5086d9d4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.58, 5.0, 12.0, 18.0, 107.03, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6800.6}', '2026-09-21 12:42:27.350978'),
  ('4f8abcd7-80de-42de-95bf-06db3acf7336', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 285.12, 5.0, 12.0, 18.0, 114.05, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6861.0}', '2026-09-21 12:43:27.671424'),
  ('09aee06e-d03d-4e6f-9e9e-9e07852a5bbb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.16, 5.0, 12.0, 18.0, 106.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6921.3}', '2026-09-21 12:44:28.010759'),
  ('ec853be1-200f-48a0-adc7-19db6c1fd0b4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 333.75, 5.0, 12.0, 18.0, 133.49, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":6981.7}', '2026-09-21 12:45:28.355815'),
  ('54719c3d-15bb-4c4d-bcd7-1977e2872def', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 287.45, 5.0, 12.0, 18.0, 114.98, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7042.1}', '2026-09-21 12:46:28.791500'),
  ('f735b385-644c-4273-a1ed-d1adf44e0115', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 275.99, 5.0, 12.0, 18.0, 110.4, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7102.4}', '2026-09-21 12:47:29.145297'),
  ('6db6bb30-fecc-4700-945f-4afc6facafa7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 285.61, 5.0, 12.0, 18.0, 114.24, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7162.8}', '2026-09-21 12:48:29.479335'),
  ('cd5e617b-f40a-43b4-9b20-614133df2b9b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.49, 5.0, 12.0, 18.0, 107.8, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7223.1}', '2026-09-21 12:49:29.822728'),
  ('a6306399-8be9-44d6-bc45-9804f38bf4d9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 279.78, 5.0, 12.0, 18.0, 111.91, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7283.4}', '2026-09-21 12:50:30.139851'),
  ('d6917873-2f8d-4a18-acd7-a3e33c6ce222', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 277.76, 5.0, 12.0, 18.0, 111.1, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7343.8}', '2026-09-21 12:51:30.479574'),
  ('e9ee25ce-cca2-4517-9b50-a2fd63a128fa', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.2, 5.0, 12.0, 18.0, 108.88, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7404.1}', '2026-09-21 12:52:30.797382'),
  ('6eedb42f-0f66-4be1-b6e4-c3b7ed39c19b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 273.04, 5.0, 12.0, 18.0, 109.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7464.4}', '2026-09-21 12:53:31.123170'),
  ('65f49ad3-2e1b-4822-b3fe-2dcd7e0b5f05', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.26, 5.0, 12.0, 18.0, 107.7, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7524.7}', '2026-09-21 12:54:31.443141'),
  ('9bce54ae-06e7-4672-a426-896c80597594', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.99, 5.0, 12.0, 18.0, 108.0, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7585.1}', '2026-09-21 12:55:31.787373'),
  ('3b94d70e-4f7b-4e09-8fcc-75afccc19295', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.66, 5.0, 12.0, 18.0, 107.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7645.4}', '2026-09-21 12:56:32.121007'),
  ('01e3897e-1a51-465a-b598-4dc306e901f6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.11, 5.0, 12.0, 18.0, 106.84, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7705.7}', '2026-09-21 12:57:32.437276'),
  ('1168ad59-e31f-4a1a-ab0e-b7e3cb6fd5f0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.92, 5.0, 12.0, 18.0, 108.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7766.1}', '2026-09-21 12:58:32.781586'),
  ('5a90e155-3291-46e8-adf3-b0c3a245b5cc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.29, 5.0, 12.0, 18.0, 108.52, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7826.4}', '2026-09-21 12:59:33.120479'),
  ('c56f3c1a-fb9d-42a9-88ce-19b1ebec321f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.83, 5.0, 12.0, 18.0, 106.73, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7886.7}', '2026-09-21 13:00:33.439604'),
  ('6490e71e-61c7-4eb4-82dd-e3e025974cb8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 282.38, 5.0, 12.0, 18.0, 112.95, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7947.1}', '2026-09-21 13:01:33.767535'),
  ('7f13c28b-f621-47f5-92f2-a7a1aa7774f8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.23, 5.0, 12.0, 18.0, 107.69, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8007.4}', '2026-09-21 13:02:34.102869'),
  ('e6f9daa4-4c7f-4057-8a99-ad7ba74b1f53', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.16, 5.0, 12.0, 18.0, 106.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8067.7}', '2026-09-21 13:03:34.421926'),
  ('b69eb0fb-6ba4-4e15-8d55-50fce50ba97d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 276.71, 5.0, 12.0, 18.0, 110.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8128.0}', '2026-09-21 13:04:34.736870'),
  ('6df74bb4-66ba-493c-b3bc-46c474eb491f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.05, 5.0, 12.0, 18.0, 107.62, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8188.4}', '2026-09-21 13:05:35.091347'),
  ('2239e47d-41aa-4d19-ad36-b60f75670ea5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.53, 5.0, 12.0, 18.0, 106.61, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8248.7}', '2026-09-21 13:06:35.416007'),
  ('3092a932-86d4-4827-94e0-ba1c37ecb062', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.99, 5.0, 12.0, 18.0, 108.0, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8309.0}', '2026-09-21 13:07:35.743557'),
  ('1d4d460e-b90b-4ad4-bfad-2a779c619379', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.98, 5.0, 12.0, 18.0, 108.79, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8369.4}', '2026-09-21 13:08:36.079015'),
  ('0fdc6cf9-c890-49e7-a37e-821a94967efb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.45, 5.0, 12.0, 18.0, 108.18, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8429.7}', '2026-09-21 13:09:36.408090'),
  ('c9c42928-cb19-4a7c-bce1-d0cb27ca7e80', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.29, 5.0, 12.0, 18.0, 106.92, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8490.0}', '2026-09-21 13:10:36.731847'),
  ('3b7ed2ee-8b01-419d-a746-cbd4ef9ccc67', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.85, 5.0, 12.0, 18.0, 107.14, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8550.3}', '2026-09-21 13:11:37.057252')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('56c0f61d-34ec-474a-93d8-d98fb0cc3698', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.66, 5.0, 12.0, 18.0, 107.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8610.7}', '2026-09-21 13:12:37.375797'),
  ('8bc5ecf8-65d6-408d-8c91-e56ce60225d5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 275.59, 5.0, 12.0, 18.0, 110.24, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8671.0}', '2026-09-21 13:13:37.703397'),
  ('cd988d92-25f5-428b-a665-f11204217451', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.14, 5.0, 12.0, 18.0, 107.26, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8731.3}', '2026-09-21 13:14:38.029706'),
  ('2e98a69f-43e5-406f-a991-6ac55b111831', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 279.94, 5.0, 12.0, 18.0, 111.97, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8791.6}', '2026-09-21 13:15:38.361200'),
  ('6cca23d7-796f-4eac-8b1d-45134f89ae3d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.95, 5.0, 12.0, 18.0, 108.78, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8852.0}', '2026-09-21 13:16:38.696697'),
  ('d6aebb41-956a-4095-9a82-52cf9329ae63', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.6, 5.0, 12.0, 18.0, 107.44, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8912.3}', '2026-09-21 13:17:39.000554'),
  ('4e96a245-da35-43a7-8bd6-66ba05725ed6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.3, 5.0, 12.0, 18.0, 108.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":8972.6}', '2026-09-21 13:18:39.320117'),
  ('9e9cb898-f38f-454c-a962-4eb16d8fd129', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.28, 5.0, 12.0, 18.0, 106.91, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9032.9}', '2026-09-21 13:19:39.651331'),
  ('ef02330d-2f94-4756-9bca-fdf18f2d28d6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.74, 5.0, 12.0, 18.0, 107.09, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9093.2}', '2026-09-21 13:20:39.975868'),
  ('ee2995e5-b963-4045-bfd0-d1162f420d08', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.19, 5.0, 12.0, 18.0, 107.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9153.6}', '2026-09-21 13:21:40.290261'),
  ('d2e62101-ed30-428d-9385-7d214b9f284e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.91, 5.0, 12.0, 18.0, 107.96, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9213.9}', '2026-09-21 13:22:40.608305'),
  ('cb3325f4-e455-4f40-a1b8-ae431f23eec5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.52, 5.0, 12.0, 18.0, 107.01, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9274.2}', '2026-09-21 13:23:40.926626'),
  ('27bb8033-e467-41c2-860f-c0a3608cf9ea', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.95, 5.0, 12.0, 18.0, 106.78, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9334.5}', '2026-09-21 13:24:41.242559'),
  ('8c5f24be-112f-4c48-ae99-f97a8387cdbf', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.45, 5.0, 12.0, 18.0, 106.98, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9394.8}', '2026-09-21 13:25:41.564833'),
  ('f39d803a-1a6e-4896-81cf-93067240d2fc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.9, 5.0, 12.0, 18.0, 108.76, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9455.2}', '2026-09-21 13:26:41.881757'),
  ('7adbc6b9-910c-46ac-81a0-029ad5e5aa56', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.4, 5.0, 12.0, 18.0, 108.96, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9515.5}', '2026-09-21 13:27:42.208199'),
  ('6ea6bf53-8d4f-4304-97e9-23e6bab9141c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.37, 5.0, 12.0, 18.0, 107.75, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9575.8}', '2026-09-21 13:28:42.523918'),
  ('1bb977cf-0f25-483a-adcf-0ef43f85afed', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.15, 5.0, 12.0, 18.0, 107.26, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9636.1}', '2026-09-21 13:29:42.841240'),
  ('da99b7de-1295-48b7-be91-8430aa98fc6a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.16, 5.0, 12.0, 18.0, 106.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9696.4}', '2026-09-21 13:30:43.163944'),
  ('2fe1d318-26a6-4294-ac97-bdc138a4532a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 283.66, 5.0, 12.0, 18.0, 113.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9756.8}', '2026-09-21 13:31:43.476920'),
  ('c2c8029b-8c3b-4eec-9baf-7a07549c2d6e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 277.1, 5.0, 12.0, 18.0, 110.84, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9817.1}', '2026-09-21 13:32:43.808364'),
  ('aa6ce036-e129-46bd-9ea0-53dd25cd01b5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 283.31, 5.0, 12.0, 18.0, 113.32, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9877.4}', '2026-09-21 13:33:44.147112'),
  ('efea0f69-3178-4034-89ab-f3800a4bdb64', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 295.71, 5.0, 12.0, 18.0, 118.28, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9937.8}', '2026-09-21 13:34:44.499611'),
  ('b1eafd25-d8de-4052-9ea5-3edb570650f8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 313.14, 5.0, 12.0, 18.0, 125.24, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":9998.2}', '2026-09-21 13:35:44.862610'),
  ('20feb1e2-13fb-4ca3-b05d-b8f771d109ee', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.07, 5.0, 12.0, 18.0, 108.83, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10058.5}', '2026-09-21 13:36:45.234310'),
  ('fc31a0bc-5141-4ce9-a306-8e116a753d24', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 437.83, 5.0, 12.0, 18.0, 175.13, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10119.0}', '2026-09-21 13:37:45.570674'),
  ('d7f62321-0c53-44c7-86d8-2ac648f625f3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.49, 5.0, 12.0, 18.0, 108.6, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10179.4}', '2026-09-21 13:38:46.110069'),
  ('48f58234-314e-4400-9167-cee292efd5fe', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 273.54, 5.0, 12.0, 18.0, 109.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10239.7}', '2026-09-21 13:39:46.446504'),
  ('f8c1716c-a132-4341-bb94-1d2168373ea9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.25, 5.0, 12.0, 18.0, 108.5, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10300.1}', '2026-09-21 13:40:46.779795'),
  ('ef95869b-6b3d-47d4-a10e-e26cbd6384ea', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.32, 5.0, 12.0, 18.0, 108.13, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10360.4}', '2026-09-21 13:41:47.106629'),
  ('971338f0-0c47-4a6a-966b-3657a8678e58', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.63, 5.0, 12.0, 18.0, 106.65, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10420.7}', '2026-09-21 13:42:47.429343'),
  ('d5cc7e7c-2714-4880-befd-82f0d4bbfae5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 283.54, 5.0, 12.0, 18.0, 113.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10481.0}', '2026-09-21 13:43:47.747690'),
  ('fbf01829-857f-4b50-ba1e-76b1bddfb9ca', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 283.7, 5.0, 12.0, 18.0, 113.48, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10541.4}', '2026-09-21 13:44:48.086160'),
  ('fce84669-1a30-4886-9313-c2cd97a7dd6c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 293.45, 5.0, 12.0, 18.0, 117.38, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10601.7}', '2026-09-21 13:45:48.422773'),
  ('301c6a84-f4c1-42e5-b46c-66d369902735', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.38, 5.0, 12.0, 18.0, 106.95, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10662.0}', '2026-09-21 13:46:48.766467'),
  ('b7efbb99-6e4b-4ebb-bf8d-18abdf15cd45', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.77, 5.0, 12.0, 18.0, 107.91, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10722.4}', '2026-09-21 13:47:49.085417'),
  ('1b5a48e4-9498-4b05-87a8-e41bcbe6adce', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 314.59, 5.0, 12.0, 18.0, 125.84, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10782.7}', '2026-09-21 13:48:49.415284'),
  ('12c7dad0-0e99-41f8-b96c-345201f842f4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 297.77, 5.0, 12.0, 18.0, 119.11, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10843.1}', '2026-09-21 13:49:49.799238'),
  ('725a5a8c-6f6c-42e1-af02-d776d6507a86', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 321.93, 5.0, 12.0, 18.0, 128.76, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10903.5}', '2026-09-21 13:50:50.155380'),
  ('2d18cfbf-7bc3-410e-8076-785077105ef0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 295.93, 5.0, 12.0, 18.0, 118.37, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":10963.9}', '2026-09-21 13:51:50.554205'),
  ('ad01a7cc-97ac-464c-bff2-8186639dc751', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.62, 5.0, 12.0, 18.0, 108.25, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11024.2}', '2026-09-21 13:52:50.912299'),
  ('d157a5e3-4a07-479c-9ed7-74818f40f0ba', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.28, 5.0, 12.0, 18.0, 108.91, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11084.5}', '2026-09-21 13:53:51.248659'),
  ('e1a16b68-b4a6-4204-8369-d53deab70275', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.06, 5.0, 12.0, 18.0, 107.62, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11144.8}', '2026-09-21 13:54:51.566776'),
  ('037f531e-7e54-49a3-825d-d86e271ef478', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 390.2, 5.0, 12.0, 18.0, 156.08, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11205.3}', '2026-09-21 13:55:51.895162'),
  ('3d2c2a12-d6c3-4e07-80b2-41fde3e545a3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 397.12, 5.0, 12.0, 18.0, 158.84, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11265.8}', '2026-09-21 13:56:52.382186'),
  ('87dafaf7-ae3e-4925-9da8-9939e76d41e5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.57, 5.0, 12.0, 18.0, 107.43, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11326.2}', '2026-09-21 13:57:52.886443'),
  ('0f510c12-4c17-4783-991c-e68c42a1c1ae', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 341.51, 5.0, 12.0, 18.0, 136.6, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11386.5}', '2026-09-21 13:58:53.218547'),
  ('a4bd7924-4fed-40a3-b6df-bd7392f3ad4c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.8, 5.0, 12.0, 18.0, 107.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11447.0}', '2026-09-21 13:59:53.692394'),
  ('7c232d05-878b-49e6-a807-cb3b235a9af9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.44, 5.0, 12.0, 18.0, 108.17, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11507.3}', '2026-09-21 14:00:54.021342'),
  ('048980dd-d285-4b1d-9fb3-16a3ef857496', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 344.66, 5.0, 12.0, 18.0, 137.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11567.7}', '2026-09-21 14:01:54.349927')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('05814fbd-b3d0-4322-9489-bf9042a6ed4a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.93, 5.0, 12.0, 18.0, 107.57, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11628.1}', '2026-09-21 14:02:54.781338'),
  ('c342a9bf-a014-426a-9961-31da8cf10ddd', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 388.08, 5.0, 12.0, 18.0, 155.22, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11688.5}', '2026-09-21 14:03:55.105946'),
  ('6335178d-e5e4-44a1-82d8-006db869f1b8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 338.03, 5.0, 12.0, 18.0, 135.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11748.9}', '2026-09-21 14:04:55.600257'),
  ('4e62e75a-0b4f-4df7-b37e-d1596d360b29', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 285.32, 5.0, 12.0, 18.0, 114.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11809.3}', '2026-09-21 14:05:56.011086'),
  ('c182bb1c-5118-4024-98af-9d1995629164', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 277.79, 5.0, 12.0, 18.0, 111.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11869.6}', '2026-09-21 14:06:56.361290'),
  ('48e0cce1-c280-4509-b678-ebcce4c0aa33', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 291.37, 5.0, 12.0, 18.0, 116.55, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11930.0}', '2026-09-21 14:07:56.701477'),
  ('f59545ce-9ace-4ddb-b857-eaa3107c61c8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.88, 5.0, 12.0, 18.0, 107.55, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":11990.3}', '2026-09-21 14:08:57.052555'),
  ('76d805e9-d784-4a1f-b04d-bdc10f5fad3e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 284.21, 5.0, 12.0, 18.0, 113.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12050.7}', '2026-09-21 14:09:57.378933'),
  ('acb2acf0-a5e6-451f-b3c5-a00ad7244aeb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.01, 5.0, 12.0, 18.0, 107.61, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12111.0}', '2026-09-21 14:10:57.728243'),
  ('2d595b4e-7d9c-4259-a0a3-4f688dc369d9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 282.68, 5.0, 12.0, 18.0, 113.07, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12171.3}', '2026-09-21 14:11:58.054965'),
  ('24f8c7fd-0967-453a-acc9-56a93d9af4b3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 284.95, 5.0, 12.0, 18.0, 113.98, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12231.7}', '2026-09-21 14:12:58.386144'),
  ('d75a0ae8-11d5-4255-87d4-27694653a7da', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.68, 5.0, 12.0, 18.0, 108.27, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12292.0}', '2026-09-21 14:13:58.723865'),
  ('39e45e1a-0060-4b61-9399-550c9ac0fc99', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.77, 5.0, 12.0, 18.0, 107.91, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12352.3}', '2026-09-21 14:14:59.048494'),
  ('80841594-1020-4452-9155-4c1ddce3f0e7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 292.04, 5.0, 12.0, 18.0, 116.82, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12412.7}', '2026-09-21 14:15:59.367180'),
  ('fcb4ac9b-3181-4b4d-a27a-1164c8f50c95', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.75, 5.0, 12.0, 18.0, 107.9, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12473.0}', '2026-09-21 14:16:59.724034'),
  ('6481c775-ecd0-4c65-b5ce-00cd99078ee0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.51, 5.0, 12.0, 18.0, 107.41, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12533.3}', '2026-09-21 14:18:00.045164'),
  ('15bdb82f-4736-412c-aba6-dfc51b504a3c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.27, 5.0, 12.0, 18.0, 107.71, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12593.7}', '2026-09-21 14:19:00.381592'),
  ('9f96fab9-3507-4153-ac59-471542d9d53a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.14, 5.0, 12.0, 18.0, 108.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12654.0}', '2026-09-21 14:20:00.715273'),
  ('ad2a3469-cb4f-4939-b1b8-4a03663389b0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.74, 5.0, 12.0, 18.0, 108.7, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12714.3}', '2026-09-21 14:21:01.038030'),
  ('62537544-365b-42a1-a9ec-fbb1328ad7ff', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.94, 5.0, 12.0, 18.0, 109.18, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12774.6}', '2026-09-21 14:22:01.356987'),
  ('ba2c106a-23c0-4532-b820-294db73588d3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.2, 5.0, 12.0, 18.0, 107.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12835.0}', '2026-09-21 14:23:01.706026'),
  ('894a360a-cd66-464c-9661-02a8f305ed01', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.87, 5.0, 12.0, 18.0, 107.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12895.3}', '2026-09-21 14:24:02.032229'),
  ('1de746e0-01b6-4b1d-848b-ea98f8a205ab', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.15, 5.0, 12.0, 18.0, 107.66, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":12955.6}', '2026-09-21 14:25:02.340294'),
  ('3a7ad1c4-ddf2-42e4-ad81-99ce77ed638c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 279.31, 5.0, 12.0, 18.0, 111.73, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13015.9}', '2026-09-21 14:26:02.660998'),
  ('a1dcc977-4d32-4cff-bab0-f7df38e7c715', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.9, 5.0, 12.0, 18.0, 108.36, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13076.3}', '2026-09-21 14:27:02.994989'),
  ('55bdd807-9a05-4336-aa93-bd6606b151dd', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 287.22, 5.0, 12.0, 18.0, 114.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13136.6}', '2026-09-21 14:28:03.312282'),
  ('b9dcec38-a414-4ab4-ad3a-a1b6eea7c483', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.74, 5.0, 12.0, 18.0, 108.3, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13196.9}', '2026-09-21 14:29:03.652078'),
  ('2c5b569c-0f5a-467f-9f13-3f3192049b93', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 273.27, 5.0, 12.0, 18.0, 109.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13257.2}', '2026-09-21 14:30:03.968161'),
  ('12681b7b-cf56-404d-9a6b-62cedc02a9e7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 281.05, 5.0, 12.0, 18.0, 112.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13317.6}', '2026-09-21 14:31:04.299792'),
  ('9234af02-e7fa-4131-84a7-cc8315bcba49', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.29, 5.0, 12.0, 18.0, 108.92, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13377.9}', '2026-09-21 14:32:04.633871'),
  ('963730d1-bbad-4aed-bb4c-be132ae71312', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 279.74, 5.0, 12.0, 18.0, 111.9, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13438.2}', '2026-09-21 14:33:04.960751'),
  ('91f4ab4e-bf14-4aaa-8899-aaa5e38c654f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 274.11, 5.0, 12.0, 18.0, 109.64, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13498.6}', '2026-09-21 14:34:05.292162'),
  ('07ad827f-91ce-4fdc-b3da-d0d28a17b9af', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.4, 5.0, 12.0, 18.0, 108.16, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13558.9}', '2026-09-21 14:35:05.626965'),
  ('4c02b004-d06c-4a3c-b4a6-30a43279b811', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.4, 5.0, 12.0, 18.0, 108.56, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13619.2}', '2026-09-21 14:36:05.954113'),
  ('2d910a81-b020-42cc-b882-febbc6677afa', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.91, 5.0, 12.0, 18.0, 107.96, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13679.6}', '2026-09-21 14:37:06.293266'),
  ('d2cca0bd-ff0c-4b9d-88d9-e10e3c486064', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.94, 5.0, 12.0, 18.0, 107.97, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13739.9}', '2026-09-21 14:38:06.619445'),
  ('203af580-7f03-4132-879e-965f7c6cf5f7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.0, 5.0, 12.0, 18.0, 106.8, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13800.2}', '2026-09-21 14:39:06.968365'),
  ('bd0af78a-a8db-4ccb-8bd9-7eb1ba751573', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.17, 5.0, 12.0, 18.0, 108.07, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13860.6}', '2026-09-21 14:40:07.298980'),
  ('41cc2757-1240-4f7a-953c-d3e5384eb3f2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.87, 5.0, 12.0, 18.0, 107.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13920.9}', '2026-09-21 14:41:07.611434'),
  ('d1a01141-919a-48b8-888a-90bd73ec6045', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.47, 5.0, 12.0, 18.0, 106.59, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":13981.2}', '2026-09-21 14:42:07.941136'),
  ('18ed1c2c-3fc4-4d8e-b3d0-b3792b9f575e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 282.87, 5.0, 12.0, 18.0, 113.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14041.6}', '2026-09-21 14:43:08.263886'),
  ('84c5e0d6-e66a-4f99-a83f-181657dc27fc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.83, 5.0, 12.0, 18.0, 107.53, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14101.9}', '2026-09-21 14:44:08.621794'),
  ('cc6c7436-59b0-42fa-9838-1b21e1dfaac4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 265.77, 5.0, 12.0, 18.0, 106.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14162.2}', '2026-09-21 14:45:08.945281'),
  ('00cff6bc-1bbb-4dfe-9284-a0bd38fc61b2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.37, 5.0, 12.0, 18.0, 108.95, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14222.6}', '2026-09-21 14:46:09.263191'),
  ('da110b46-71e9-4440-a1c4-8726c14d5c54', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.69, 5.0, 12.0, 18.0, 106.67, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14282.9}', '2026-09-21 14:47:09.592133'),
  ('66db8f87-ce12-4c9b-9b08-4a512540f67d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.41, 5.0, 12.0, 18.0, 106.97, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14343.2}', '2026-09-21 14:48:09.933106'),
  ('d7bf6faa-f99e-4fae-9567-bfff57e59695', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 265.67, 5.0, 12.0, 18.0, 106.27, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14403.5}', '2026-09-21 14:49:10.259230'),
  ('2562dc8a-b704-46c5-951c-5f9bc46ae4ae', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.98, 5.0, 12.0, 18.0, 107.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14463.8}', '2026-09-21 14:50:10.567105'),
  ('8502ff2a-c16e-47d4-93ff-1f68cc97356b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.63, 5.0, 12.0, 18.0, 107.45, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14524.2}', '2026-09-21 14:51:10.899086'),
  ('a228979a-1978-444b-8e73-086498d07912', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 395.25, 5.0, 12.0, 18.0, 158.09, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14584.6}', '2026-09-21 14:52:11.222265')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('8ce2fb6d-3830-4f86-8699-0aec360b7fd5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.58, 5.0, 12.0, 18.0, 109.03, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14645.0}', '2026-09-21 14:53:11.728238'),
  ('71f71b91-926a-4f91-96dd-d57d75cc4cd4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 515.68, 5.0, 12.0, 18.0, 206.26, 'Duration 515.7ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14705.5}', '2026-09-21 14:54:12.066488'),
  ('129b1fa6-66f9-4725-87d1-740e040bff50', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 275.3, 5.0, 12.0, 18.0, 110.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14766.1}', '2026-09-21 14:55:12.766759'),
  ('d404ac58-ed90-4527-8537-97e20cf0f827', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 296.12, 5.0, 12.0, 18.0, 118.45, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14826.4}', '2026-09-21 14:56:13.103286'),
  ('00c1bb56-c0a4-47e8-97f0-49c09b47a7fe', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.57, 5.0, 12.0, 18.0, 107.43, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14886.7}', '2026-09-21 14:57:13.456948'),
  ('0f924673-159c-4cd0-9091-cee62f798701', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.11, 5.0, 12.0, 18.0, 108.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":14947.1}', '2026-09-21 14:58:13.786058'),
  ('949f90bb-f07a-4d8e-a1d7-49acccc37e2e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 1286.96, 5.0, 12.0, 18.0, 514.79, 'Duration 1287.0ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15346.8}', '2026-09-21 15:04:52.529824'),
  ('d58ae337-0584-4f01-afac-f91153619cff', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 460.04, 5.0, 12.0, 18.0, 184.01, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15407.9}', '2026-09-21 15:05:54.491863'),
  ('e69b077b-537a-4e13-92c4-fdcb6c262127', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 466.87, 5.0, 12.0, 18.0, 186.74, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15468.7}', '2026-09-21 15:06:55.121895'),
  ('684e1475-dab1-40b0-aa2d-9a378f1967e5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 433.26, 5.0, 12.0, 18.0, 173.29, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15529.4}', '2026-09-21 15:07:55.990607'),
  ('7f1d2433-8783-4a5e-8b8c-7a9a83205611', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.48, 5.0, 12.0, 18.0, 108.99, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15589.8}', '2026-09-21 15:08:56.539334'),
  ('c9d22dee-a8d2-4c57-a545-80a053c197c1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 266.21, 5.0, 12.0, 18.0, 106.48, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15650.2}', '2026-09-21 15:09:56.913019'),
  ('cfec5e43-77a1-404b-b0e0-64066c03cb61', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 274.57, 5.0, 12.0, 18.0, 109.83, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15710.5}', '2026-09-21 15:10:57.233803'),
  ('792c998a-b4c2-4e31-a7aa-4cc5c7b30cbb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 273.25, 5.0, 12.0, 18.0, 109.3, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15770.8}', '2026-09-21 15:11:57.562262'),
  ('5c64ebb6-137c-4ea9-a638-2e2229384935', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.52, 5.0, 12.0, 18.0, 108.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15831.2}', '2026-09-21 15:12:57.895672'),
  ('066f9141-aab6-4ec4-a1b9-243bf462f8e1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 267.81, 5.0, 12.0, 18.0, 107.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15891.5}', '2026-09-21 15:13:58.236461'),
  ('b531c359-cc26-453f-910a-169bb28e19f3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 275.58, 5.0, 12.0, 18.0, 110.23, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15951.9}', '2026-09-21 15:14:58.587482'),
  ('194c2963-8ea5-4614-987e-f5b0512f102c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.98, 5.0, 12.0, 18.0, 109.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16012.2}', '2026-09-21 15:15:58.930888'),
  ('7f471b16-3a25-4071-ab11-8172440fad64', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.27, 5.0, 12.0, 18.0, 107.71, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16072.5}', '2026-09-21 15:16:59.268171'),
  ('923f81cc-71d3-4577-a7f4-d5ad6a666c94', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 301.51, 5.0, 12.0, 18.0, 120.61, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16132.9}', '2026-09-21 15:17:59.605701'),
  ('9c76618c-60f6-42be-aadd-3c5cff78571c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 556.01, 5.0, 12.0, 18.0, 222.4, 'Duration 556.0ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16261.5}', '2026-09-21 15:20:07.886694'),
  ('c265bdf7-a67b-44dd-822e-f43a0cf55ac7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 457.87, 5.0, 12.0, 18.0, 183.14, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16322.3}', '2026-09-21 15:21:08.839716'),
  ('d672b9c1-7d71-4c7d-be5a-b0a80f7bc8cc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.55, 5.0, 12.0, 18.0, 108.62, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16382.7}', '2026-09-21 15:22:09.431193'),
  ('c8e94968-de72-4d37-9765-b7538fa701fd', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 286.98, 5.0, 12.0, 18.0, 114.79, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16443.1}', '2026-09-21 15:23:09.774926'),
  ('f754c52a-1ed0-47e4-ab48-89b2df057af0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.09, 5.0, 12.0, 18.0, 107.24, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16503.4}', '2026-09-21 15:24:10.105716'),
  ('bc271384-5a33-4ebf-9ac5-83ff895d8cef', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 275.38, 5.0, 12.0, 18.0, 110.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16563.7}', '2026-09-21 15:25:10.438011'),
  ('5dd75d69-881a-41bf-b8d8-8ce8d7fd11ff', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 287.14, 5.0, 12.0, 18.0, 114.85, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16624.1}', '2026-09-21 15:26:10.776534'),
  ('4c234136-69a6-4c9b-958a-cdd56f14c023', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 362.61, 5.0, 12.0, 18.0, 145.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16684.5}', '2026-09-21 15:27:11.141164'),
  ('2799b82b-f410-45d6-b107-9cc8afcd5546', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 829.25, 5.0, 12.0, 18.0, 331.69, 'Duration 829.2ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17596.1}', '2026-09-21 15:42:22.273870'),
  ('fb3dfefa-28c4-4665-804c-2dfbbb6a29b8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 644.03, 5.0, 12.0, 18.0, 257.61, 'Duration 644.0ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26117.1}', '2026-09-21 18:04:23.134564'),
  ('b15b492a-de80-4117-8ddb-a95385d70630', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 430.84, 5.0, 12.0, 18.0, 172.34, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26177.8}', '2026-09-21 18:05:24.408268'),
  ('178b8ac6-8230-4a5a-b731-7b7cefd331a0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 369.97, 5.0, 12.0, 18.0, 147.98, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26238.6}', '2026-09-21 18:06:25.118895'),
  ('0503b19e-1e15-447a-8a68-3be4bb47ff48', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 417.41, 5.0, 12.0, 18.0, 166.96, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26299.2}', '2026-09-21 18:07:25.750678'),
  ('840da523-db29-43fc-bae2-2e4d49daad92', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 518.7, 5.0, 12.0, 18.0, 207.46, 'Duration 518.7ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26360.0}', '2026-09-21 18:08:26.474171'),
  ('08c148fa-8304-4d53-ae9a-c921334cfad7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 423.46, 5.0, 12.0, 18.0, 169.37, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26420.6}', '2026-09-21 18:09:27.215826'),
  ('79c2a841-340f-4fe4-b39c-6a56ec89a567', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 506.18, 5.0, 12.0, 18.0, 202.46, 'Duration 506.2ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26481.4}', '2026-09-21 18:10:27.798363'),
  ('ed27095c-538a-4da2-ae72-f7b3a74b5ce1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 556.41, 5.0, 12.0, 18.0, 222.48, 'Duration 556.4ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26542.5}', '2026-09-21 18:11:28.796251'),
  ('1d67727f-d889-4e9f-bf51-e4549d31d722', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 458.4, 5.0, 12.0, 18.0, 183.35, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26603.6}', '2026-09-21 18:12:30.125878'),
  ('4d2969d2-c0f5-45ef-936a-b107a5ee61d9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'FAILURE', 200, 545.57, 5.0, 12.0, 18.0, 218.22, 'Duration 545.6ms exceeded SLA of 500.0ms', '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26664.5}', '2026-09-21 18:13:30.747741'),
  ('b79680ed-983a-4d77-98f8-1947a43a8eb9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 424.37, 5.0, 12.0, 18.0, 169.74, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26725.2}', '2026-09-21 18:14:31.764534'),
  ('af29d5cb-aeaf-4516-be72-2bb9f8ce5899', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 447.5, 5.0, 12.0, 18.0, 178.99, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26786.1}', '2026-09-21 18:15:32.551884'),
  ('cf8b6b64-63c6-4afb-a31f-846f19e3676a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 396.62, 5.0, 12.0, 18.0, 158.65, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26846.8}', '2026-09-21 18:16:33.385686'),
  ('9bcb3024-cab3-4288-b1eb-c5561cc8fad5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 426.92, 5.0, 12.0, 18.0, 170.76, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26907.5}', '2026-09-21 18:17:34.055037'),
  ('f71ca3db-8f5b-4aa9-8089-bc3e37002b26', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 396.89, 5.0, 12.0, 18.0, 158.75, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":26968.1}', '2026-09-21 18:18:34.707566'),
  ('6063a04b-1aa8-47e0-92b2-ef698ecbf82d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 371.45, 5.0, 12.0, 18.0, 148.58, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27028.6}', '2026-09-21 18:19:35.223000'),
  ('88255f3b-6378-4222-b3ca-c734f5a267a6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 282.13, 5.0, 12.0, 18.0, 112.85, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27089.0}', '2026-09-21 18:20:35.677529'),
  ('e0e22cfa-152f-4419-b089-1bde050a291d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 423.61, 5.0, 12.0, 18.0, 169.44, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27149.4}', '2026-09-21 18:21:36.012583'),
  ('62b8f77b-f2fe-4d20-acbf-8f55b1b92316', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 270.81, 5.0, 12.0, 18.0, 108.32, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27209.9}', '2026-09-21 18:22:36.577569'),
  ('f524906b-4cc5-4792-9abc-3898ccd5c3b9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.13, 5.0, 12.0, 18.0, 107.65, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27270.2}', '2026-09-21 18:23:36.913460'),
  ('b2c76135-aa47-4f8d-ac6b-2587574c82ca', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 272.14, 5.0, 12.0, 18.0, 108.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27330.5}', '2026-09-21 18:24:37.246359')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('1a1cc376-b12b-4dd6-ba31-ccea39ac05d2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 345.29, 5.0, 12.0, 18.0, 138.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27391.1}', '2026-09-21 18:25:37.730377'),
  ('44c746d2-b16b-421e-b1f9-e15de17ad427', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.02, 5.0, 12.0, 18.0, 107.61, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27451.4}', '2026-09-21 18:26:38.135519'),
  ('d0445051-b8da-4ec0-88a5-f943db18dc45', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 387.99, 5.0, 12.0, 18.0, 155.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27511.8}', '2026-09-21 18:27:38.469814'),
  ('60032a78-df9a-4512-9ce4-0d5a7ffcf2a2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 269.2, 5.0, 12.0, 18.0, 107.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27572.2}', '2026-09-21 18:28:38.945335'),
  ('7fe5a493-83f5-472d-8cff-d2b530f07742', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 268.21, 5.0, 12.0, 18.0, 107.28, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27632.5}', '2026-09-21 18:29:39.254632'),
  ('a8dbb302-e7c1-46a3-b31c-ba9f015ad0a9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 271.4, 5.0, 12.0, 18.0, 108.56, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":27692.8}', '2026-09-21 18:30:39.568444'),
  ('0f33c93f-b10a-4296-b7ff-ba9a0f0b02d0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 125.27, 5.0, 12.0, 18.0, 50.11, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.3}', '2026-09-28 09:40:04.195595'),
  ('16068dff-32b5-4901-8dd7-9fa0202f8607', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.19, 5.0, 12.0, 18.0, 1.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":90.2}', '2026-09-28 09:41:04.198853'),
  ('d3fd0f82-6379-40f2-b47b-d3e2c08454ad', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 20.59, 5.0, 12.0, 18.0, 8.23, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":150.2}', '2026-09-28 09:42:04.200393'),
  ('96154af7-2f54-4c2f-a47b-911cd781b007', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 60.1, 5.0, 12.0, 18.0, 24.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":240.3}', '2026-09-28 09:43:34.202002'),
  ('f38a9593-c723-4dda-9dd1-6cb875588d79', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 147.2, 5.0, 12.0, 18.0, 58.87, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":300.4}', '2026-09-28 09:44:34.205846'),
  ('fe92217b-dca3-485f-800e-116e6319553f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 95.9, 5.0, 12.0, 18.0, 38.36, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":390.3}', '2026-09-28 09:46:04.206559'),
  ('808c7423-eaa9-413b-8fbd-4c57f7a78346', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 20.33, 5.0, 12.0, 18.0, 8.13, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":480.2}', '2026-09-28 09:47:34.202538'),
  ('3440e181-56af-44d5-8530-df80010857e0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.34, 5.0, 12.0, 18.0, 1.73, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":570.2}', '2026-09-28 09:49:04.202104'),
  ('5bafb5cb-9714-4b69-9adc-68999e2dfaa2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.3, 5.0, 12.0, 18.0, 2.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":660.2}', '2026-09-28 09:50:34.206036'),
  ('deebedb6-50c2-49d6-b3c9-5c55405b11f6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 22.18, 5.0, 12.0, 18.0, 8.87, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":720.3}', '2026-09-28 09:51:34.206612'),
  ('a5ea074c-861b-470e-baf1-0901442839ef', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 22.2, 5.0, 12.0, 18.0, 8.88, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":810.3}', '2026-09-28 09:53:04.193535'),
  ('3fe12d55-cc78-4436-8049-cd4bb2a06c11', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.58, 5.0, 12.0, 18.0, 1.83, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":900.2}', '2026-09-28 09:54:34.189023'),
  ('8c88539a-21ea-419b-9e18-933fbfca7412', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 9.4, 5.0, 12.0, 18.0, 3.76, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":960.2}', '2026-09-28 09:55:34.205694'),
  ('248d26ef-4736-42d0-8f4a-4c2520e33b10', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.16, 5.0, 12.0, 18.0, 2.06, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1050.2}', '2026-09-28 09:57:04.194474'),
  ('f1187a62-b830-41d5-9421-15800de63503', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.25, 5.0, 12.0, 18.0, 1.3, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1110.2}', '2026-09-28 09:58:04.201492'),
  ('58e05732-c48a-48c2-872a-92fcfd455a4c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.73, 5.0, 12.0, 18.0, 1.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1200.2}', '2026-09-28 09:59:34.196197'),
  ('f49f175f-1b93-48e9-b5cf-dfc54af8af9f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 200.67, 5.0, 12.0, 18.0, 80.26, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1260.9}', '2026-09-28 10:00:34.681202'),
  ('9098b138-7f7a-4a6d-a2c2-b6011055779b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.52, 5.0, 12.0, 18.0, 2.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1350.2}', '2026-09-28 10:02:04.195987'),
  ('80cd5473-3670-4288-8270-a78f9a70034a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.44, 5.0, 12.0, 18.0, 2.18, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1410.2}', '2026-09-28 10:03:04.202715'),
  ('0261ece2-bd2b-44cd-85f9-196d5e2becd8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.72, 5.0, 12.0, 18.0, 1.49, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1500.2}', '2026-09-28 10:04:34.198957'),
  ('5b8c9cc3-0367-4913-9495-ed7d402ec12b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 6.92, 5.0, 12.0, 18.0, 2.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1590.2}', '2026-09-28 10:06:04.194206'),
  ('a952972d-63bb-4661-8183-756417e94720', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.58, 5.0, 12.0, 18.0, 1.83, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1680.2}', '2026-09-28 10:07:34.201475'),
  ('65d44a25-2e01-4321-a1e2-4ba7a407f7c4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 49.43, 5.0, 12.0, 18.0, 19.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1770.4}', '2026-09-28 10:09:04.302652'),
  ('15c3c9e8-8921-4e3d-aabd-f4aca0807d26', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 352.98, 5.0, 12.0, 18.0, 141.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3660.7}', '2026-09-28 10:40:34.273725'),
  ('16498f9f-05bc-48c3-a6db-c26b804d87d5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 30.89, 5.0, 12.0, 18.0, 12.36, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3750.2}', '2026-09-28 10:42:04.192893'),
  ('3b64201e-6e3a-405e-a7f7-b2a8db949797', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.31, 5.0, 12.0, 18.0, 1.33, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3840.2}', '2026-09-28 10:43:34.202257'),
  ('0cf3f1e7-f348-4b5f-8da6-3f0e6c8babc3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 9.75, 5.0, 12.0, 18.0, 3.9, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3930.2}', '2026-09-28 10:45:04.203943'),
  ('f4d36d6e-7956-42a3-9cd0-1f2f47048179', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.84, 5.0, 12.0, 18.0, 1.54, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":4020.2}', '2026-09-28 10:46:34.202511'),
  ('336b8b39-b57e-47e2-99aa-17b1571b9eda', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.27, 5.0, 12.0, 18.0, 1.71, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":4080.2}', '2026-09-28 10:47:34.203203'),
  ('5195cf20-31c1-480b-abe0-0154899c4aa2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 35.07, 5.0, 12.0, 18.0, 14.03, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":4170.2}', '2026-09-28 10:49:04.193306'),
  ('b86a5d31-db3e-46b2-87c3-49184f16aacc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.25, 5.0, 12.0, 18.0, 2.1, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":4230.2}', '2026-09-28 10:50:04.198553'),
  ('370dd75c-2023-4066-aa70-ccb43305fb27', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 54.69, 5.0, 12.0, 18.0, 21.88, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":4290.3}', '2026-09-28 10:51:04.221377'),
  ('f64d1f18-5271-4782-acdd-3121402a9738', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.65, 5.0, 12.0, 18.0, 1.86, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":4380.2}', '2026-09-28 10:52:34.202852'),
  ('c7c962bf-2f04-4c19-b21a-ebc27f91c4ea', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 128.54, 5.0, 12.0, 18.0, 51.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.3}', '2026-09-28 10:54:34.005631'),
  ('57c79b71-0d1f-40e6-9292-cc9ea9629a84', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 32.77, 5.0, 12.0, 18.0, 13.1, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":120.3}', '2026-09-28 10:56:04.018059'),
  ('c86a9ba2-9173-4443-8ac9-a5ab467aa559', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 11.05, 5.0, 12.0, 18.0, 4.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":210.2}', '2026-09-28 10:57:34.019621'),
  ('7ae70752-78ff-467f-bbe2-1c058c2e89da', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.82, 5.0, 12.0, 18.0, 1.93, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":300.2}', '2026-09-28 10:59:04.004978'),
  ('56deb97b-5732-44bc-928a-b075059c2b2a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 72.36, 5.0, 12.0, 18.0, 28.95, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.2}', '2026-09-28 11:23:45.644244'),
  ('d6d47c42-7b31-43a1-b964-c8c7ff9a336d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.13, 5.0, 12.0, 18.0, 1.65, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":120.1}', '2026-09-28 11:25:15.632571'),
  ('6b175fcc-e23f-49f6-a310-a1bd0c98a480', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.3, 5.0, 12.0, 18.0, 1.72, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":210.1}', '2026-09-28 11:26:45.640346'),
  ('31adfc43-a4c2-4c51-835e-b754a58a7dc9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.76, 5.0, 12.0, 18.0, 1.11, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":270.1}', '2026-09-28 11:27:45.641944'),
  ('262322b2-1232-453e-b84d-35a9f59095e8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 131.3, 5.0, 12.0, 18.0, 52.52, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.4}', '2026-09-28 11:39:41.990901'),
  ('1afc2f6f-5d04-4031-85bb-4e78ac7bb4ff', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 19.36, 5.0, 12.0, 18.0, 7.74, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":120.3}', '2026-09-28 11:41:11.990589'),
  ('93548413-5da3-4b5a-86d9-7270e7f3231f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.98, 5.0, 12.0, 18.0, 1.59, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":210.2}', '2026-09-28 11:42:41.977002')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('02c90733-06ea-485d-ab94-9f139fab4f85', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.38, 5.0, 12.0, 18.0, 1.35, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":270.2}', '2026-09-28 11:43:41.983131'),
  ('9571827d-5d2a-4f8b-8d34-bff8dd477b9e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 107.21, 5.0, 12.0, 18.0, 42.88, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":360.4}', '2026-09-28 11:45:11.991274'),
  ('f67ecb6a-e979-4619-aec3-c442a66271f6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 19.85, 5.0, 12.0, 18.0, 7.93, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":420.3}', '2026-09-28 11:46:11.992564'),
  ('7e3c5b60-7ce3-41a4-8862-e9a0e1d95995', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 30.43, 5.0, 12.0, 18.0, 12.16, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":510.3}', '2026-09-28 11:47:41.990932'),
  ('5e9c8d44-3d60-4137-ae65-4fa1a5ffca82', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 6.16, 5.0, 12.0, 18.0, 2.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":600.3}', '2026-09-28 11:49:11.989475'),
  ('c8a73bea-cdf7-4e61-a82a-d7cc24f49f3c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.29, 5.0, 12.0, 18.0, 1.71, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":690.3}', '2026-09-28 11:50:41.983423'),
  ('5d310500-30f6-4a6e-96a0-240d0de042c1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.98, 5.0, 12.0, 18.0, 1.99, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":750.3}', '2026-09-28 11:51:41.992650'),
  ('01ec2aea-6f24-4978-9109-aa6eeb3855f1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.57, 5.0, 12.0, 18.0, 1.43, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":840.3}', '2026-09-28 11:53:12.001755'),
  ('5da031b9-281d-4273-a493-01cffdf40750', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.13, 5.0, 12.0, 18.0, 2.05, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":930.3}', '2026-09-28 11:54:41.998379'),
  ('2087b9d2-7bd7-4119-ac60-e06c5fb1be9a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.91, 5.0, 12.0, 18.0, 2.36, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":990.3}', '2026-09-28 11:55:42.002158'),
  ('d9d36666-97a7-4790-a41a-370942f443af', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 18.29, 5.0, 12.0, 18.0, 7.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1080.3}', '2026-09-28 11:57:11.975933'),
  ('d3867847-ebf8-45bf-adbc-a55443bf73a1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 13.66, 5.0, 12.0, 18.0, 5.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1140.3}', '2026-09-28 11:58:11.988216'),
  ('14b13ab8-898e-49b0-8286-bae3d57650ad', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.72, 5.0, 12.0, 18.0, 1.49, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1230.3}', '2026-09-28 11:59:42.002806'),
  ('ef7933bd-930c-4b6b-b1eb-ee1781518add', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 11.15, 5.0, 12.0, 18.0, 4.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1320.2}', '2026-09-28 12:01:11.978565'),
  ('c1004158-ba75-4a3a-99fd-898dd8b5fbfa', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.16, 5.0, 12.0, 18.0, 1.26, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1380.2}', '2026-09-28 12:02:11.983292'),
  ('4f71bf71-a2bf-4d66-8a1c-f02a695e0212', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 21.48, 5.0, 12.0, 18.0, 8.59, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1470.3}', '2026-09-28 12:03:41.985525'),
  ('ab252f67-f143-4f45-b7f1-4b113b18373f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.48, 5.0, 12.0, 18.0, 1.39, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1560.3}', '2026-09-28 12:05:11.989127'),
  ('df95feaf-32e9-4d23-bfa6-aa2e8b898ac1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 18.72, 5.0, 12.0, 18.0, 7.49, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1620.3}', '2026-09-28 12:06:11.989619'),
  ('444a1f06-3639-473f-9934-e50f06a6cd07', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.63, 5.0, 12.0, 18.0, 1.45, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1710.3}', '2026-09-28 12:07:41.990410'),
  ('a0034b5b-e441-4b1a-ad62-953414f3383a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 16.58, 5.0, 12.0, 18.0, 6.63, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1800.3}', '2026-09-28 12:09:11.984036'),
  ('7a061986-fd09-476b-a716-e1d230feafa7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.65, 5.0, 12.0, 18.0, 1.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1890.2}', '2026-09-28 12:10:41.978612'),
  ('c4ede4ea-8f10-4f9a-82ea-7cde3b07e69a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 20.98, 5.0, 12.0, 18.0, 8.39, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1950.3}', '2026-09-28 12:11:41.979458'),
  ('c1693178-fa80-4495-beb9-eca541b62511', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.44, 5.0, 12.0, 18.0, 1.38, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2010.3}', '2026-09-28 12:12:41.982382'),
  ('4a7ed04d-d610-47e3-9ecf-db2aa19a2dae', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.91, 5.0, 12.0, 18.0, 1.17, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2070.3}', '2026-09-28 12:13:41.991119'),
  ('b84893d2-1312-468c-9134-33aedcaf042a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.91, 5.0, 12.0, 18.0, 1.96, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2130.3}', '2026-09-28 12:14:42.000289'),
  ('40c1ca58-880b-4a81-9db5-44ffd862656b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.71, 5.0, 12.0, 18.0, 1.88, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2220.3}', '2026-09-28 12:16:12.007840'),
  ('4a2730ea-20fa-4b89-8c72-de25cdea2b9b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.02, 5.0, 12.0, 18.0, 1.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2310.3}', '2026-09-28 12:17:41.979555'),
  ('17fc2da1-02a2-4f5e-91e6-8cbaab35037c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.35, 5.0, 12.0, 18.0, 0.94, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2370.2}', '2026-09-28 12:18:41.986672'),
  ('23169a2e-43a2-4e69-bbff-a509c68b4b13', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.55, 5.0, 12.0, 18.0, 1.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2460.3}', '2026-09-28 12:20:11.993991'),
  ('c2eb0959-94ff-4f47-b4cd-e73b99870fa7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.62, 5.0, 12.0, 18.0, 1.45, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2550.2}', '2026-09-28 12:21:41.978413'),
  ('f9c666ba-bb4f-4baa-b90c-5bcf4fe2ff70', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.47, 5.0, 12.0, 18.0, 1.79, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2610.2}', '2026-09-28 12:22:41.982052'),
  ('0e03dba8-d059-4b5c-848d-8d76338270f4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.44, 5.0, 12.0, 18.0, 1.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2700.3}', '2026-09-28 12:24:11.975957'),
  ('0a243c00-cf80-4106-b855-d4120c7b5e2f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.2, 5.0, 12.0, 18.0, 1.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2760.3}', '2026-09-28 12:25:11.987750'),
  ('eb7d11f1-34f0-4b8c-8bc6-dd2426ef4526', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.68, 5.0, 12.0, 18.0, 1.47, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2850.3}', '2026-09-28 12:26:41.976712'),
  ('97021322-744f-4dc2-9022-0517bb3f5585', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.02, 5.0, 12.0, 18.0, 1.61, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2910.3}', '2026-09-28 12:27:41.991170'),
  ('e0d6b782-f768-49e1-8501-a5bc00aba44b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 17.66, 5.0, 12.0, 18.0, 7.06, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3000.3}', '2026-09-28 12:29:11.983295'),
  ('fd0918a5-d3df-4fe5-9c6e-0300fabdea46', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.99, 5.0, 12.0, 18.0, 1.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3060.3}', '2026-09-28 12:30:11.988334'),
  ('b2091f0a-3a9d-47ed-9486-7dc6de8b826c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.81, 5.0, 12.0, 18.0, 1.52, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":3120.3}', '2026-09-28 12:31:11.990101'),
  ('8b595fbd-b5d4-4071-b8a7-2a93b24fbd70', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 10.36, 5.0, 12.0, 18.0, 4.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":7380.3}', '2026-09-28 13:42:12.005850'),
  ('0af0dcf8-bbb1-4e55-9e47-f211e31fac16', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 95.98, 5.0, 12.0, 18.0, 38.39, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15570.8}', '2026-09-28 15:58:42.377895'),
  ('50a70fb9-25fb-425f-9e7d-8ce3b30b5636', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 46.87, 5.0, 12.0, 18.0, 18.74, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15660.3}', '2026-09-28 16:00:11.983404'),
  ('501757e1-3493-458a-ae44-09cfdbab7798', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.54, 5.0, 12.0, 18.0, 1.82, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15750.3}', '2026-09-28 16:01:41.978447'),
  ('3ac32272-2db4-4e90-8de7-5dcba6e2c5eb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 85.72, 5.0, 12.0, 18.0, 34.28, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15810.3}', '2026-09-28 16:02:41.990336'),
  ('acc0b60c-ece0-4c82-9949-c2ff76d51a76', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 13.5, 5.0, 12.0, 18.0, 5.4, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15900.3}', '2026-09-28 16:04:11.986659'),
  ('aab56559-b577-40cc-a654-4991eca57332', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.84, 5.0, 12.0, 18.0, 1.54, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":15990.3}', '2026-09-28 16:05:41.981940'),
  ('206dfb9a-06b4-4f82-a1d5-1ba4323a278e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 22.94, 5.0, 12.0, 18.0, 9.17, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16050.3}', '2026-09-28 16:06:41.991451'),
  ('83a426e0-2c5e-4255-b07f-058404d96dae', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.47, 5.0, 12.0, 18.0, 1.39, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16140.2}', '2026-09-28 16:08:11.980391'),
  ('ea4caf75-72f5-4155-a974-c2b563343360', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.94, 5.0, 12.0, 18.0, 1.17, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16230.3}', '2026-09-28 16:09:41.989012'),
  ('d4c8f494-b73c-4bf8-b538-ca884169b857', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.41, 5.0, 12.0, 18.0, 1.76, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16320.2}', '2026-09-28 16:11:11.978305'),
  ('d80279b6-f931-4800-8636-c82e57554808', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.54, 5.0, 12.0, 18.0, 1.01, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16380.3}', '2026-09-28 16:12:11.988478')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('b4e3a327-7a02-402f-be32-1931b67b1e14', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.05, 5.0, 12.0, 18.0, 1.22, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16470.2}', '2026-09-28 16:13:41.976385'),
  ('1ef029d6-e07d-45d7-ac70-093d41b3b0ba', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.84, 5.0, 12.0, 18.0, 1.93, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16530.2}', '2026-09-28 16:14:41.982539'),
  ('e2ba989b-3ecc-42e2-8ecd-6d39a0016de9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.84, 5.0, 12.0, 18.0, 1.54, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16590.3}', '2026-09-28 16:15:41.990492'),
  ('672932dd-7496-4e6f-8fe8-728819cb4779', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.97, 5.0, 12.0, 18.0, 1.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16650.3}', '2026-09-28 16:16:41.990680'),
  ('54162bec-12f2-4487-8212-3eb9e2998ef6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 51.21, 5.0, 12.0, 18.0, 20.48, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16740.3}', '2026-09-28 16:18:11.979450'),
  ('97ee582d-412a-449b-bd49-9076bf5d4cab', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 44.23, 5.0, 12.0, 18.0, 17.69, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16830.3}', '2026-09-28 16:19:41.980914'),
  ('36876292-728d-4f8a-8abb-28cea5b29b93', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.08, 5.0, 12.0, 18.0, 2.03, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16890.3}', '2026-09-28 16:20:41.989609'),
  ('91ae5e45-99d4-4d6f-ad69-3a057fa1a6c1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 11.85, 5.0, 12.0, 18.0, 4.74, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":16980.3}', '2026-09-28 16:22:11.987296'),
  ('e33842ce-44d9-4ab1-921d-95434cd56e05', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.44, 5.0, 12.0, 18.0, 1.37, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17070.2}', '2026-09-28 16:23:41.987333'),
  ('dcb66679-3956-46b5-b714-31ba52472bb2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.16, 5.0, 12.0, 18.0, 1.26, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17130.3}', '2026-09-28 16:24:41.988749'),
  ('69c36a14-33f4-497a-980e-84f01cab03b6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.31, 5.0, 12.0, 18.0, 1.72, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17220.3}', '2026-09-28 16:26:11.990112'),
  ('abcddc08-347e-43d9-8d93-592701376ad7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.98, 5.0, 12.0, 18.0, 1.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17310.2}', '2026-09-28 16:27:41.977065'),
  ('c3cda08c-00df-423f-a7c9-0d0fbf43cdc2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.96, 5.0, 12.0, 18.0, 1.58, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17370.2}', '2026-09-28 16:28:41.981557'),
  ('3cd98ff7-4d67-4c2a-a876-5c720620d703', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 6.05, 5.0, 12.0, 18.0, 2.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17430.3}', '2026-09-28 16:29:41.987976'),
  ('794d17f4-a4be-4455-a6d4-757f24d5c90b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 17.47, 5.0, 12.0, 18.0, 6.99, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17520.3}', '2026-09-28 16:31:11.981745'),
  ('eca57862-5a56-45de-86a4-5b9382db9070', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.79, 5.0, 12.0, 18.0, 1.52, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17580.3}', '2026-09-28 16:32:11.988195'),
  ('e95ecf99-29e9-45a5-bff7-49ed75ddd211', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.11, 5.0, 12.0, 18.0, 1.64, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17640.3}', '2026-09-28 16:33:11.990475'),
  ('0631be99-a7e9-4ff8-a332-99cad2867377', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.05, 5.0, 12.0, 18.0, 1.22, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17730.2}', '2026-09-28 16:34:41.978790'),
  ('ffb97654-b2c2-42e0-8e8c-02fb7c95d3e0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.98, 5.0, 12.0, 18.0, 1.59, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17820.2}', '2026-09-28 16:36:11.986119'),
  ('0a29267f-4fc0-49c2-8954-f80be8afcd17', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.58, 5.0, 12.0, 18.0, 1.83, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17910.2}', '2026-09-28 16:37:41.977619'),
  ('2710a921-7521-471e-824d-dcdc8e9b3da7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.87, 5.0, 12.0, 18.0, 1.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":17970.3}', '2026-09-28 16:38:41.981582'),
  ('2f1d9b30-9df3-4b04-befb-10a193923abe', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 24.76, 5.0, 12.0, 18.0, 9.9, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18060.3}', '2026-09-28 16:40:11.985190'),
  ('b11d33b5-8de9-40a4-828b-08fdf96e88f7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 48.59, 5.0, 12.0, 18.0, 19.44, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18150.3}', '2026-09-28 16:41:41.981776'),
  ('0eb004b1-2e44-4058-847a-5720ab9947b1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.55, 5.0, 12.0, 18.0, 1.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18240.2}', '2026-09-28 16:43:11.986223'),
  ('753efafb-5940-4737-8d84-ae3342cc6cb3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.83, 5.0, 12.0, 18.0, 2.33, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18330.2}', '2026-09-28 16:44:41.982973'),
  ('c04dc7fd-32d5-4b5a-800a-aaa018ff548c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.04, 5.0, 12.0, 18.0, 1.22, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18390.2}', '2026-09-28 16:45:41.985232'),
  ('3826aad7-9ff7-4ed2-a5d1-7af33ef9b613', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.75, 5.0, 12.0, 18.0, 1.5, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18480.2}', '2026-09-28 16:47:11.980093'),
  ('0ed063e0-4c13-4025-a94b-056c122d7362', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.59, 5.0, 12.0, 18.0, 1.84, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18540.3}', '2026-09-28 16:48:11.986670'),
  ('11f641fa-aa83-4628-bcc8-468f36db6f6a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.68, 5.0, 12.0, 18.0, 1.47, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18630.3}', '2026-09-28 16:49:41.989800'),
  ('ddefc34a-6313-4086-9698-569272b827f7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 6.51, 5.0, 12.0, 18.0, 2.6, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18720.3}', '2026-09-28 16:51:11.982323'),
  ('5be0dd1c-a7ed-43b0-b2eb-981674830df2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.0, 5.0, 12.0, 18.0, 1.6, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18780.3}', '2026-09-28 16:52:11.988765'),
  ('f81d7d78-ee96-47dd-a0db-182f4e8ede85', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 16.7, 5.0, 12.0, 18.0, 6.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18870.3}', '2026-09-28 16:53:41.990495'),
  ('289b32e5-79c0-48ea-a51b-fe90774806fa', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.84, 5.0, 12.0, 18.0, 1.54, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18960.2}', '2026-09-28 16:55:11.984911'),
  ('aacff880-8a18-4810-ab8f-10feef141c66', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.72, 5.0, 12.0, 18.0, 2.29, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19050.2}', '2026-09-28 16:56:41.978939'),
  ('06413cf2-b989-48d1-8b8c-b6f2d6fe81c3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.54, 5.0, 12.0, 18.0, 2.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19110.3}', '2026-09-28 16:57:41.990727'),
  ('36cfe95b-cf16-4b37-86a6-0c46c2beed60', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.41, 5.0, 12.0, 18.0, 1.36, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19170.3}', '2026-09-28 16:58:41.991720'),
  ('7ba44c45-330e-4a67-96c5-be259d20a307', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 39.5, 5.0, 12.0, 18.0, 15.8, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19260.3}', '2026-09-28 17:00:11.979835'),
  ('f8efc265-853b-4171-9f3e-287185d3591a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.63, 5.0, 12.0, 18.0, 1.85, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19320.3}', '2026-09-28 17:01:11.986600'),
  ('d9c71dcc-cb6c-469f-bfa7-4f47364adb00', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.6, 5.0, 12.0, 18.0, 1.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19380.2}', '2026-09-28 17:02:11.989994'),
  ('9dfe3faa-ab49-4f67-918f-bb169758aec3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.6, 5.0, 12.0, 18.0, 1.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19470.3}', '2026-09-28 17:03:41.990403'),
  ('9ba46202-9de2-4183-a6eb-23761c6cb73a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.35, 5.0, 12.0, 18.0, 1.34, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19560.2}', '2026-09-28 17:05:11.984984'),
  ('27f3ed3d-105f-424a-acb2-00ca6c490369', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.29, 5.0, 12.0, 18.0, 1.32, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19650.3}', '2026-09-28 17:06:41.989394'),
  ('ba311b31-a0c0-41c5-92c7-741ae36c614c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.73, 5.0, 12.0, 18.0, 1.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19710.3}', '2026-09-28 17:07:41.990641'),
  ('83e29a67-91c3-46bb-91ff-d3f8ce622e90', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 6.1, 5.0, 12.0, 18.0, 2.44, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19800.3}', '2026-09-28 17:09:11.988041'),
  ('ee273f04-3236-443f-8fe6-22436cff1761', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.11, 5.0, 12.0, 18.0, 1.64, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19890.2}', '2026-09-28 17:10:41.981478'),
  ('368fa518-9eb6-42a0-972b-b10bd1d05017', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 7.28, 5.0, 12.0, 18.0, 2.91, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":19950.3}', '2026-09-28 17:11:41.990673'),
  ('b5ce6637-4604-4754-baa4-2e7e76b5978b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.67, 5.0, 12.0, 18.0, 1.47, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20040.2}', '2026-09-28 17:13:11.978995'),
  ('cc3226da-21e0-4668-bc60-162ab3b9ad36', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.18, 5.0, 12.0, 18.0, 1.27, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20130.3}', '2026-09-28 17:14:41.986419'),
  ('69eea11a-de7a-4a8a-8b25-a5f75e95784f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.85, 5.0, 12.0, 18.0, 2.34, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20220.3}', '2026-09-28 17:16:11.976461'),
  ('99be75db-f803-4b56-8615-6fd788f79c54', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.05, 5.0, 12.0, 18.0, 1.62, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20280.3}', '2026-09-28 17:17:11.987111')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('4613aa31-6ec7-482c-894e-840691e989d4', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.89, 5.0, 12.0, 18.0, 1.55, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20370.2}', '2026-09-28 17:18:41.986965'),
  ('0749dbc7-3a52-4b97-8f27-4f041084f5a2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 7.96, 5.0, 12.0, 18.0, 3.18, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20460.3}', '2026-09-28 17:20:11.985725'),
  ('3871021d-aa53-4ab9-9ffb-2cd67b692fc7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.53, 5.0, 12.0, 18.0, 1.41, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20520.3}', '2026-09-28 17:21:11.990917'),
  ('ffb2899e-249b-4ce9-b599-a21baf917215', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.93, 5.0, 12.0, 18.0, 1.57, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20610.2}', '2026-09-28 17:22:41.980890'),
  ('9ce91dd4-1251-47b3-9303-55b9ad0ab058', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.8, 5.0, 12.0, 18.0, 1.12, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20670.3}', '2026-09-28 17:23:41.991568'),
  ('ed36f6e2-9332-4ec0-916e-9a2d16416bc7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.34, 5.0, 12.0, 18.0, 2.14, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20760.3}', '2026-09-28 17:25:11.991502'),
  ('ac60647b-7439-4920-993f-778de2f787b0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.37, 5.0, 12.0, 18.0, 1.75, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20850.2}', '2026-09-28 17:26:41.978059'),
  ('6b18c05d-499c-4b65-8e48-fa9f6e703002', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.18, 5.0, 12.0, 18.0, 1.67, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20910.2}', '2026-09-28 17:27:41.980516'),
  ('c9beac30-d646-4b61-bf20-53a6770f51e5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.95, 5.0, 12.0, 18.0, 1.58, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":20970.3}', '2026-09-28 17:28:41.982672'),
  ('ca6a5fbc-89cd-49f4-b5ad-13baab88981a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.32, 5.0, 12.0, 18.0, 1.33, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21030.2}', '2026-09-28 17:29:41.985454'),
  ('9aaaba56-ba6c-4c99-a6e7-608d8dd2849f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.33, 5.0, 12.0, 18.0, 1.33, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21090.3}', '2026-09-28 17:30:41.991178'),
  ('d9872d96-d02b-438c-ab4d-82a5eb3fbfef', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.5, 5.0, 12.0, 18.0, 1.8, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21180.2}', '2026-09-28 17:32:11.977245'),
  ('2cd95890-3ad1-4b4d-919a-b99165b5820c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.07, 5.0, 12.0, 18.0, 1.23, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21240.2}', '2026-09-28 17:33:11.983636'),
  ('0c0e52ce-2223-4980-b0be-3e9182d6e720', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.83, 5.0, 12.0, 18.0, 1.93, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21330.2}', '2026-09-28 17:34:41.981419'),
  ('b08e9371-ca57-4864-a03a-71823a5b075b', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.21, 5.0, 12.0, 18.0, 1.28, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21390.2}', '2026-09-28 17:35:41.984851'),
  ('79709c5c-3cd0-44dd-8f9e-c22b4d444b06', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.37, 5.0, 12.0, 18.0, 1.35, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21450.3}', '2026-09-28 17:36:41.985753'),
  ('85518c48-05a4-4127-9c89-ad884b72e532', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 8.85, 5.0, 12.0, 18.0, 3.54, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21540.2}', '2026-09-28 17:38:11.977491'),
  ('81f161a4-57ea-4787-b098-9895f35db2f8', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.29, 5.0, 12.0, 18.0, 1.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21600.2}', '2026-09-28 17:39:11.980710'),
  ('e5154a0c-6329-4896-8dbe-2be03c54d2c0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.43, 5.0, 12.0, 18.0, 1.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21660.2}', '2026-09-28 17:40:11.986057'),
  ('8bed1642-37ca-4636-bafd-826af20f8f91', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.55, 5.0, 12.0, 18.0, 1.42, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21750.3}', '2026-09-28 17:41:41.988992'),
  ('5494d66b-0abc-4ecb-a604-d5cd9b751ecc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.44, 5.0, 12.0, 18.0, 1.38, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21840.2}', '2026-09-28 17:43:11.978420'),
  ('77cc9dd9-f932-4f3f-9bf2-393eb53e5bc3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.87, 5.0, 12.0, 18.0, 1.55, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21900.3}', '2026-09-28 17:44:11.990138'),
  ('74c8ca11-8e9b-4b54-89eb-b69c6ec68ab2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.73, 5.0, 12.0, 18.0, 2.29, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":21990.3}', '2026-09-28 17:45:41.985057'),
  ('e7fe45e3-d354-4d12-bfd7-a2591170a3e2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.15, 5.0, 12.0, 18.0, 1.66, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22080.3}', '2026-09-28 17:47:11.991656'),
  ('e1aa9ef5-48e6-44bc-8cef-2627a51f5ccc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.9, 5.0, 12.0, 18.0, 1.56, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22170.2}', '2026-09-28 17:48:41.976584'),
  ('2d714408-a2d6-44d0-b7dc-3452a6357d83', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.37, 5.0, 12.0, 18.0, 0.95, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22230.2}', '2026-09-28 17:49:41.982186'),
  ('74751874-0797-40ce-86cc-d0d2ed28c834', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.89, 5.0, 12.0, 18.0, 1.56, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22290.3}', '2026-09-28 17:50:41.991084'),
  ('bfe58a95-2b52-4521-b8a4-83e3ed834cde', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.34, 5.0, 12.0, 18.0, 1.74, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22380.2}', '2026-09-28 17:52:11.978693'),
  ('53d3c872-afd2-429c-9ab5-a9b2df19a922', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.13, 5.0, 12.0, 18.0, 1.25, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22440.2}', '2026-09-28 17:53:11.984991'),
  ('dcf0b94a-e002-42d7-96b0-1b767ddaee4c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.06, 5.0, 12.0, 18.0, 1.63, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22500.3}', '2026-09-28 17:54:12.000911'),
  ('cf1f229e-1e19-48fb-9a4d-1273a4d1f602', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.28, 5.0, 12.0, 18.0, 2.11, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22590.2}', '2026-09-28 17:55:41.976668'),
  ('020139eb-3fed-4180-a93e-55d08b2f25f2', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.89, 5.0, 12.0, 18.0, 1.56, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22650.3}', '2026-09-28 17:56:41.990427'),
  ('f8f0dc86-2a16-4dda-be9c-2fe04efa4f1f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.97, 5.0, 12.0, 18.0, 1.59, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22740.2}', '2026-09-28 17:58:11.976117'),
  ('6ac6d5cf-d0b4-47bc-b296-ffe4ead36fb9', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.46, 5.0, 12.0, 18.0, 1.38, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":22800.2}', '2026-09-28 17:59:11.985005'),
  ('35728974-7c1f-4203-b72a-3b5bf20c8c4c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.13, 5.0, 12.0, 18.0, 1.25, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.2}', '2026-09-29 11:53:11.159173'),
  ('1fe436ab-8441-47fa-baa6-0aa4100bc2f1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.04, 5.0, 12.0, 18.0, 0.82, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":90.3}', '2026-09-29 11:54:11.164532'),
  ('bd579308-fd7d-4a56-a791-cde22b04c1e6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 1.76, 5.0, 12.0, 18.0, 0.7, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":180.3}', '2026-09-29 11:55:41.173005'),
  ('7885e0e9-c39b-4ea4-8e44-f925e06736b3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.66, 5.0, 12.0, 18.0, 1.46, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.1}', '2026-09-29 11:57:30.053621'),
  ('a33690ea-1845-49b5-9eea-990309f31769', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.17, 5.0, 12.0, 18.0, 0.87, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":90.1}', '2026-09-29 11:58:30.056041'),
  ('59bbb9f3-8af7-45e0-acc9-41b54c88bf99', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 1.73, 5.0, 12.0, 18.0, 0.69, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":180.1}', '2026-09-29 12:00:00.056652'),
  ('49c1fbb0-3387-44f6-b085-bd8c0c9a13b6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.31, 5.0, 12.0, 18.0, 0.92, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":240.1}', '2026-09-29 12:01:00.067860'),
  ('99be2ea8-c861-4a0c-b5c4-5fed4ae2e6d3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.66, 5.0, 12.0, 18.0, 1.06, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":330.1}', '2026-09-29 12:02:30.067095'),
  ('58841305-aa2a-4149-888f-7821a6a988e5', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.38, 5.0, 12.0, 18.0, 0.95, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":420.1}', '2026-09-29 12:04:00.053452'),
  ('27c78161-66ce-49a5-9f8e-1214aa4f91cc', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.6, 5.0, 12.0, 18.0, 1.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":480.1}', '2026-09-29 12:05:00.063362'),
  ('13e8602d-d1fe-4ba2-a1f4-766313d274d7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.75, 5.0, 12.0, 18.0, 1.1, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":570.1}', '2026-09-29 12:06:30.053303'),
  ('6b492461-2c76-476c-8219-ce35ee4b92a1', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 1.85, 5.0, 12.0, 18.0, 0.74, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":630.1}', '2026-09-29 12:07:30.061112'),
  ('6fe9f2db-55e8-4403-8952-cfd6430f0efd', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 1.59, 5.0, 12.0, 18.0, 0.64, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":720.1}', '2026-09-29 12:09:00.067525'),
  ('df38729b-8b39-426a-9928-45b903a11520', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.73, 5.0, 12.0, 18.0, 1.09, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":810.1}', '2026-09-29 12:10:30.062095'),
  ('8cae545b-41d2-4b55-b54d-c5806ff699ce', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.9, 5.0, 12.0, 18.0, 1.16, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":900.1}', '2026-09-29 12:12:00.052877'),
  ('3177b882-3263-4a88-bfde-f873622b82de', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 1.99, 5.0, 12.0, 18.0, 0.8, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":960.1}', '2026-09-29 12:13:00.062859')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('ae929488-bb7f-4944-ab92-5fc0fab3d517', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.18, 5.0, 12.0, 18.0, 0.87, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1050.1}', '2026-09-29 12:14:30.055208'),
  ('60629266-fff7-4431-bab7-812a3b9ed2e0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 65.32, 5.0, 12.0, 18.0, 26.13, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.2}', '2026-09-29 12:20:27.205150'),
  ('6b8d6933-45d1-4db0-90cf-b136b571b895', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.41, 5.0, 12.0, 18.0, 0.97, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":90.1}', '2026-09-29 12:21:27.210348'),
  ('446c9724-c149-4c18-83f9-55d6524099a0', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 55.64, 5.0, 12.0, 18.0, 22.25, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18090.2}', '2026-09-29 17:21:27.203378'),
  ('df68c428-4ec7-4591-8666-3a862b64de89', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.26, 5.0, 12.0, 18.0, 1.3, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18150.1}', '2026-09-29 17:22:27.207857'),
  ('748f5361-759f-431f-9003-cee540035049', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 1.38, 5.0, 12.0, 18.0, 0.55, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18150.1}', '2026-09-29 17:22:27.207857'),
  ('2e7f5e51-dfdf-4121-8feb-d2fb559abd40', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.94, 5.0, 12.0, 18.0, 1.18, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18210.1}', '2026-09-29 17:23:27.214883'),
  ('ea975615-c04c-4a41-975c-ec7540540aa0', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.87, 5.0, 12.0, 18.0, 1.15, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18210.1}', '2026-09-29 17:23:27.214883'),
  ('78d0e7ac-6c70-45ad-be5f-fcdd4a1037ee', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.97, 5.0, 12.0, 18.0, 1.19, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18270.1}', '2026-09-29 17:24:27.222031'),
  ('5eaef423-5408-438b-847e-0e13d58b33b4', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.75, 5.0, 12.0, 18.0, 1.1, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18270.2}', '2026-09-29 17:24:27.222031'),
  ('e0308aa8-5f49-45de-8b70-cf1e0f99d392', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 1.64, 5.0, 12.0, 18.0, 0.66, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18360.1}', '2026-09-29 17:25:57.214543'),
  ('4c3f2e63-7d0d-4e5d-accd-d4f3f2dc2ab3', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 1.97, 5.0, 12.0, 18.0, 0.79, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18360.2}', '2026-09-29 17:25:57.214543'),
  ('2771fbab-7f2d-4af5-8c86-012319e64a13', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 1.82, 5.0, 12.0, 18.0, 0.73, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18420.1}', '2026-09-29 17:26:57.214659'),
  ('3ef189f9-80d6-41c4-8087-597cc8229a3b', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 1.73, 5.0, 12.0, 18.0, 0.69, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18420.2}', '2026-09-29 17:26:57.214659'),
  ('9fda5649-e0c3-4e3d-8f0a-499a9f4c14bf', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.16, 5.0, 12.0, 18.0, 1.66, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18510.1}', '2026-09-29 17:28:27.208991'),
  ('dc2f18ab-602b-4cf5-8271-b0d12dcd3f42', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.53, 5.0, 12.0, 18.0, 1.41, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18510.1}', '2026-09-29 17:28:27.208991'),
  ('1d2d1ea8-a20a-42ed-b3df-2e2afdf85ced', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.47, 5.0, 12.0, 18.0, 0.99, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18600.1}', '2026-09-29 17:29:57.215185'),
  ('dc96dab1-3b2d-4ed0-8e6e-70b1de19a654', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 1.86, 5.0, 12.0, 18.0, 0.75, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18600.2}', '2026-09-29 17:29:57.215185'),
  ('a4d96f59-f3bc-4300-8664-c195f83bb3a3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.01, 5.0, 12.0, 18.0, 1.6, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18690.1}', '2026-09-29 17:31:27.205925'),
  ('e3bfb079-f53d-4154-ab8c-278a50c7f99d', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.02, 5.0, 12.0, 18.0, 1.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18690.1}', '2026-09-29 17:31:27.205925'),
  ('3e63ae7e-617e-4857-97ad-829bcb10ed3f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.03, 5.0, 12.0, 18.0, 1.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18750.1}', '2026-09-29 17:32:27.210958'),
  ('63fa47f2-be29-4738-9497-efaa85e5284b', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.28, 5.0, 12.0, 18.0, 1.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":18750.1}', '2026-09-29 17:32:27.210958'),
  ('057f1b38-6be1-4f6a-816f-b4e3425a77ff', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.05, 5.0, 12.0, 18.0, 2.02, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.2}', '2026-09-30 08:37:39.762700'),
  ('f95a3495-85e4-4ac0-9a0d-f82a63e413b6', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.57, 5.0, 12.0, 18.0, 1.43, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.2}', '2026-09-30 08:37:39.762700'),
  ('39bee306-6adc-4f2d-a729-5f70f8d8607c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.23, 5.0, 12.0, 18.0, 1.29, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":120.2}', '2026-09-30 08:39:09.755546'),
  ('6b458ba2-bf10-43f4-bc57-869a5ec00193', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.89, 5.0, 12.0, 18.0, 1.55, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":120.2}', '2026-09-30 08:39:09.755546'),
  ('0300de05-2233-4e0b-8bf5-a870f458934f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.29, 5.0, 12.0, 18.0, 1.71, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":180.2}', '2026-09-30 08:40:09.760640'),
  ('8c285d5b-adcb-4b5c-bac2-53b4587c4306', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.34, 5.0, 12.0, 18.0, 1.33, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":180.2}', '2026-09-30 08:40:09.760640'),
  ('05820510-1978-4dbc-9a8b-b28d01009a24', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.91, 5.0, 12.0, 18.0, 1.57, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":270.2}', '2026-09-30 08:41:39.756312'),
  ('4864cfa2-8fee-4ef3-be31-4b83a5f61bc8', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.49, 5.0, 12.0, 18.0, 1.4, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":270.2}', '2026-09-30 08:41:39.756312'),
  ('c73c4a64-72c3-47ed-be5c-0499ef8d8764', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.18, 5.0, 12.0, 18.0, 1.67, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":330.2}', '2026-09-30 08:42:39.765075'),
  ('08863479-5cfb-43de-a5c8-d451f5d3bc6c', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.95, 5.0, 12.0, 18.0, 1.58, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":330.2}', '2026-09-30 08:42:39.765075'),
  ('a7b9c702-3579-4c8b-bf2d-0fa4a02f4589', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 10.1, 5.0, 12.0, 18.0, 4.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":420.2}', '2026-09-30 08:44:09.762194'),
  ('8fdd7890-62ed-45ac-8f42-83ce8cb6c14d', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.31, 5.0, 12.0, 18.0, 1.32, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":420.2}', '2026-09-30 08:44:09.762194'),
  ('02a3de77-c3d1-405b-bac3-6f5cf19947ee', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 34.72, 5.0, 12.0, 18.0, 13.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":480.2}', '2026-09-30 08:45:09.771876'),
  ('34c97727-746a-488c-b52e-51eb7742884d', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 9.79, 5.0, 12.0, 18.0, 3.92, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":480.2}', '2026-09-30 08:45:09.771876'),
  ('d84b143d-d8d7-4494-a087-b24c73fe3782', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 8.28, 5.0, 12.0, 18.0, 3.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":570.2}', '2026-09-30 08:46:39.756973'),
  ('3b147616-cd77-4e65-b7ee-fe0f003a18eb', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 20.28, 5.0, 12.0, 18.0, 8.11, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":570.2}', '2026-09-30 08:46:39.756973'),
  ('9fbafbc2-bf25-47a1-a2ed-4d429bea0e47', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 7.61, 5.0, 12.0, 18.0, 3.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":630.2}', '2026-09-30 08:47:39.768433'),
  ('c39ae70c-7d26-4af6-9a3d-b24ae206ed8a', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 12.71, 5.0, 12.0, 18.0, 5.08, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":630.2}', '2026-09-30 08:47:39.768433'),
  ('6a635469-00c5-4af7-b12a-3b8a0a701d60', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 10.54, 5.0, 12.0, 18.0, 4.22, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":690.2}', '2026-09-30 08:48:39.777543'),
  ('0a5686cb-9fd3-432d-a263-e27486eb78d9', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 12.91, 5.0, 12.0, 18.0, 5.16, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":690.3}', '2026-09-30 08:48:39.777543'),
  ('927b206f-a5b6-42dd-951f-112623ff82ae', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 13.01, 5.0, 12.0, 18.0, 5.2, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":780.2}', '2026-09-30 08:50:09.770005'),
  ('3af08428-f754-4f29-b169-ce8ff8f77bf6', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 8.03, 5.0, 12.0, 18.0, 3.21, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":780.2}', '2026-09-30 08:50:09.770005'),
  ('31de17e6-bbde-4841-92e3-e8ffa03d70ea', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.06, 5.0, 12.0, 18.0, 2.02, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":870.2}', '2026-09-30 08:51:39.754948'),
  ('bc74a49a-bf32-4cd3-8cb8-88f1500dd085', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.3, 5.0, 12.0, 18.0, 1.32, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":870.2}', '2026-09-30 08:51:39.754948'),
  ('ead1372f-4e43-438a-b134-738a54d74dc6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.38, 5.0, 12.0, 18.0, 1.75, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":930.2}', '2026-09-30 08:52:39.758289'),
  ('a743dce5-eddc-4f2c-b806-0a3b21afe8da', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.64, 5.0, 12.0, 18.0, 1.45, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":930.2}', '2026-09-30 08:52:39.758289'),
  ('caf158b7-7f1e-4678-9953-b111e11bbe6a', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 5.18, 5.0, 12.0, 18.0, 2.07, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1020.2}', '2026-09-30 08:54:09.754367'),
  ('98708954-307a-41d0-9e3e-e95fb19ce98f', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.43, 5.0, 12.0, 18.0, 1.37, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1020.2}', '2026-09-30 08:54:09.754367')
ON CONFLICT DO NOTHING;
INSERT INTO synthetic_results ("id", "check_id", "status", "status_code", "total_duration_ms", "dns_duration_ms", "tcp_duration_ms", "tls_duration_ms", "ttfb_duration_ms", "failure_reason", "response_snippet", "created_at") VALUES
  ('5641b251-f360-4c68-a56b-4603e28d47ae', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.29, 5.0, 12.0, 18.0, 1.32, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1080.2}', '2026-09-30 08:55:09.764246'),
  ('0ec13f11-1645-409d-b0e2-4331333e5bd4', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.36, 5.0, 12.0, 18.0, 1.34, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1080.2}', '2026-09-30 08:55:09.764246'),
  ('91001d8d-c46c-4318-8682-df6273bac942', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.21, 5.0, 12.0, 18.0, 1.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1170.2}', '2026-09-30 08:56:39.760567'),
  ('09e0c567-b81b-4b67-8252-33d70eeae181', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.22, 5.0, 12.0, 18.0, 0.89, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1170.2}', '2026-09-30 08:56:39.760567'),
  ('00180714-7761-42f6-9b75-955d763f105f', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.89, 5.0, 12.0, 18.0, 1.56, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1260.2}', '2026-09-30 08:58:09.754639'),
  ('238fa613-0add-4c64-86b1-7f34dcc63638', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.13, 5.0, 12.0, 18.0, 0.85, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1260.2}', '2026-09-30 08:58:09.754639'),
  ('8c34fc2c-d22c-4ba6-ba9b-05abe2a2ef26', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.45, 5.0, 12.0, 18.0, 1.38, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1320.2}', '2026-09-30 08:59:09.759898'),
  ('114bea40-2515-4ebd-a613-7a1074c7a653', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.53, 5.0, 12.0, 18.0, 1.01, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1320.2}', '2026-09-30 08:59:09.759898'),
  ('79ad192a-d794-4f07-8c93-8fd622aa8b1c', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.28, 5.0, 12.0, 18.0, 1.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1380.2}', '2026-09-30 09:00:09.763492'),
  ('3175d92a-83ba-4225-b0b4-5714e9b3aa9c', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 1.71, 5.0, 12.0, 18.0, 0.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1380.2}', '2026-09-30 09:00:09.763492'),
  ('a08e46d5-a4c9-4efa-9641-9d31b589cdfb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.03, 5.0, 12.0, 18.0, 0.81, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1470.2}', '2026-09-30 09:01:39.758628'),
  ('7f36f3ce-0a5c-4801-893f-fef96a5142bf', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.45, 5.0, 12.0, 18.0, 0.98, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1470.2}', '2026-09-30 09:01:39.758628'),
  ('dcbc7cda-6296-4ef6-895d-1f626865198d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.21, 5.0, 12.0, 18.0, 1.68, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1530.2}', '2026-09-30 09:02:39.765318'),
  ('9cf38f23-338e-485d-961a-de83dc495463', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.49, 5.0, 12.0, 18.0, 1.0, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1530.2}', '2026-09-30 09:02:39.765318'),
  ('984209a8-6e7c-4bf3-b376-66999fbfbed6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 2.69, 5.0, 12.0, 18.0, 1.08, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1620.2}', '2026-09-30 09:04:09.754156'),
  ('09842b42-cdd2-4451-af17-7240de0c72be', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 1.99, 5.0, 12.0, 18.0, 0.8, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1620.2}', '2026-09-30 09:04:09.754156'),
  ('4c30fa58-c56b-4a47-806d-55012157507e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.93, 5.0, 12.0, 18.0, 1.57, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1680.2}', '2026-09-30 09:05:09.763611'),
  ('141150cc-afe1-442b-9dfc-849fa1426aa8', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.6, 5.0, 12.0, 18.0, 1.04, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1680.2}', '2026-09-30 09:05:09.763611'),
  ('a6627518-c4da-4ef1-b830-5ad9072155f7', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 16.34, 5.0, 12.0, 18.0, 6.53, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1770.2}', '2026-09-30 09:06:39.759933'),
  ('833b44e5-f5ff-4be7-a875-c5ba6687f5e7', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 6.35, 5.0, 12.0, 18.0, 2.54, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1770.2}', '2026-09-30 09:06:39.759933'),
  ('d468c4b2-c516-4af8-96da-f155a398797e', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 9.42, 5.0, 12.0, 18.0, 3.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1830.2}', '2026-09-30 09:07:39.763227'),
  ('76c0cd56-0118-432e-bc8b-a3d14c56f0de', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.81, 5.0, 12.0, 18.0, 1.52, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1830.2}', '2026-09-30 09:07:39.763227'),
  ('44a7a223-d0de-4d01-b4e4-c98dd9ef193d', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.83, 5.0, 12.0, 18.0, 1.93, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1890.2}', '2026-09-30 09:08:39.766259'),
  ('8c9280ea-81a3-4744-89af-d5154050e9de', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 1.94, 5.0, 12.0, 18.0, 0.78, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1890.2}', '2026-09-30 09:08:39.766259'),
  ('559500fb-9454-4263-b035-ee0ba060d770', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.57, 5.0, 12.0, 18.0, 1.43, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1980.2}', '2026-09-30 09:10:09.754037'),
  ('7a970305-267c-46ff-ae03-256c4cd1749a', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.67, 5.0, 12.0, 18.0, 1.47, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":1980.2}', '2026-09-30 09:10:09.754037'),
  ('2b543e6d-4cc1-4ca7-989c-67e8ef3d9f03', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.07, 5.0, 12.0, 18.0, 1.63, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2040.2}', '2026-09-30 09:11:09.754669'),
  ('902ef1f0-8478-46ee-a1cf-a933121ffecc', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.12, 5.0, 12.0, 18.0, 1.25, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2040.2}', '2026-09-30 09:11:09.754669'),
  ('43b7e944-3c13-4f27-8ace-1aca0e1ea2cb', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 18.18, 5.0, 12.0, 18.0, 7.27, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2100.2}', '2026-09-30 09:12:09.762595'),
  ('12345bc1-0664-4e3e-b287-e70b6b2a0dac', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 4.43, 5.0, 12.0, 18.0, 1.77, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2100.2}', '2026-09-30 09:12:09.762595'),
  ('057dc531-4fbb-46a1-8c5b-2581c6ff6970', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 4.1, 5.0, 12.0, 18.0, 1.64, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2190.2}', '2026-09-30 09:13:39.761137'),
  ('72848bf1-9711-4df6-aac1-5983eef77320', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 2.84, 5.0, 12.0, 18.0, 1.14, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2190.2}', '2026-09-30 09:13:39.761137'),
  ('9352389c-297a-4e16-b85c-00b4b20afae6', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 14.83, 5.0, 12.0, 18.0, 5.93, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2280.2}', '2026-09-30 09:15:09.765283'),
  ('a9978fab-529a-4af9-914d-0e5adb34883f', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 4.95, 5.0, 12.0, 18.0, 1.98, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2280.2}', '2026-09-30 09:15:09.765283'),
  ('45685b26-e597-4531-b1f9-cf8c894a05d3', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 3.46, 5.0, 12.0, 18.0, 1.38, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2370.2}', '2026-09-30 09:16:39.757040'),
  ('ab7383c0-107b-4ca5-b11e-c7a819c21706', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.82, 5.0, 12.0, 18.0, 1.53, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":2370.2}', '2026-09-30 09:16:39.757040'),
  ('60a36bb2-cddc-44ff-bb71-1e7c50884cad', '7002ab09-d6f4-4182-929f-6fc0564d0cad', 'SUCCESS', 200, 138.29, 5.0, 12.0, 18.0, 55.31, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.4}', '2026-09-30 09:54:53.119263'),
  ('405f1d56-b108-41bf-9ee7-303177a3eaed', '0e8d6ef1-aaf6-4b3f-94aa-791b9e74da0b', 'SUCCESS', 200, 3.64, 5.0, 12.0, 18.0, 1.45, NULL, '{"status":"healthy","service":"RicozAppMon Core Backend","uptime_seconds":30.4}', '2026-09-30 09:54:53.119263')
ON CONFLICT DO NOTHING;

-- Data for table: notification_logs (0 rows)