-- Enable TimescaleDB Extension if available
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rum_events_app_created ON rum_events(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rum_sessions_app_last_active ON rum_sessions(application_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_app_start_time ON spans(application_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_group_created ON error_events(error_group_id, created_at DESC);
