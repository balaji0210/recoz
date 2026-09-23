import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, Enum, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# ----------------- User & Team Models -----------------
class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    memberships = relationship("Membership", back_populates="user", cascade="all, delete-orphan")

class Team(Base):
    __tablename__ = "teams"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    
    memberships = relationship("Membership", back_populates="team", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="team", cascade="all, delete-orphan")
    notification_channels = relationship("NotificationChannel", back_populates="team", cascade="all, delete-orphan")

class Membership(Base):
    __tablename__ = "memberships"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(32), default="engineer", nullable=False)  # admin, engineer, viewer
    created_at = Column(DateTime, default=utc_now)
    
    user = relationship("User", back_populates="memberships")
    team = relationship("Team", back_populates="memberships")

class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    channel_type = Column(String(32), nullable=False)  # email, webhook, sms, pagerduty, jira, servicenow
    config_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    
    team = relationship("Team", back_populates="notification_channels")

# ----------------- Application Model -----------------
class Application(Base):
    __tablename__ = "applications"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), index=True, nullable=False)
    tier = Column(String(32), default="agent")  # agent, proxy, external
    environment = Column(String(32), default="production")  # production, staging, development
    ingest_key_hash = Column(String(64), unique=True, index=True, nullable=False)
    ingest_key_prefix = Column(String(16), nullable=False)
    allowed_origins = Column(JSON, default=lambda: ["*"])
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    team = relationship("Team", back_populates="applications")
    rum_events = relationship("RUMEvent", back_populates="application", cascade="all, delete-orphan")
    error_groups = relationship("ErrorGroup", back_populates="application", cascade="all, delete-orphan")
    spans = relationship("Span", back_populates="application", cascade="all, delete-orphan")
    alert_rules = relationship("AlertRule", back_populates="application", cascade="all, delete-orphan")
    synthetic_checks = relationship("SyntheticCheck", back_populates="application", cascade="all, delete-orphan")

# ----------------- RUM Models -----------------
class RUMSession(Base):
    __tablename__ = "rum_sessions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    session_id = Column(String(64), index=True, nullable=False)
    user_id = Column(String(128), nullable=True)
    user_agent = Column(Text, nullable=True)
    browser = Column(String(64), nullable=True)
    os = Column(String(64), nullable=True)
    device = Column(String(64), nullable=True)
    ip_address = Column(String(64), nullable=True)
    started_at = Column(DateTime, default=utc_now)
    last_active_at = Column(DateTime, default=utc_now)
    page_views_count = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)

class RUMEvent(Base):
    __tablename__ = "rum_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    session_id = Column(String(64), index=True, nullable=False)
    event_type = Column(String(32), nullable=False)  # page_view, web_vitals, route_change, fetch, xhr, error
    url = Column(Text, nullable=False)
    route = Column(String(255), index=True, nullable=True)
    duration = Column(Float, nullable=True)  # in ms
    status_code = Column(Integer, nullable=True)
    lcp = Column(Float, nullable=True)
    inp = Column(Float, nullable=True)
    cls = Column(Float, nullable=True)
    ttfb = Column(Float, nullable=True)
    fcp = Column(Float, nullable=True)
    fid = Column(Float, nullable=True)
    trace_id = Column(String(64), index=True, nullable=True)
    span_id = Column(String(64), nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now, index=True)
    
    application = relationship("Application", back_populates="rum_events")

# ----------------- Error Models -----------------
class ErrorGroup(Base):
    __tablename__ = "error_groups"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    fingerprint = Column(String(64), index=True, nullable=False)
    error_type = Column(String(255), nullable=False)
    message_template = Column(Text, nullable=False)
    status = Column(String(32), default="unhandled")  # unhandled, resolved, ignored
    first_seen = Column(DateTime, default=utc_now)
    last_seen = Column(DateTime, default=utc_now)
    occurrence_count = Column(Integer, default=1)
    affected_users_count = Column(Integer, default=1)
    last_release = Column(String(64), nullable=True)
    
    application = relationship("Application", back_populates="error_groups")
    events = relationship("ErrorEvent", back_populates="error_group", cascade="all, delete-orphan")

class ErrorEvent(Base):
    __tablename__ = "error_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    error_group_id = Column(String(36), ForeignKey("error_groups.id", ondelete="CASCADE"), index=True, nullable=False)
    application_id = Column(String(36), index=True, nullable=False)
    session_id = Column(String(64), nullable=True)
    trace_id = Column(String(64), nullable=True)
    error_type = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    raw_stack = Column(Text, nullable=True)
    symbolicated_stack = Column(JSON, nullable=True)
    url = Column(Text, nullable=True)
    route = Column(String(255), nullable=True)
    browser = Column(String(64), nullable=True)
    os = Column(String(64), nullable=True)
    device = Column(String(64), nullable=True)
    release_version = Column(String(64), nullable=True)
    breadcrumbs_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=utc_now, index=True)
    
    error_group = relationship("ErrorGroup", back_populates="events")

class SourceMap(Base):
    __tablename__ = "source_maps"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    release_version = Column(String(64), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    map_content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)

# ----------------- Distributed Trace Models -----------------
class Span(Base):
    __tablename__ = "spans"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    trace_id = Column(String(64), index=True, nullable=False)
    span_id = Column(String(64), index=True, nullable=False)
    parent_span_id = Column(String(64), nullable=True)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    service_name = Column(String(128), index=True, nullable=False)
    name = Column(String(255), index=True, nullable=False)
    kind = Column(String(32), default="internal")  # server, client, internal, producer, consumer
    start_time = Column(DateTime, index=True, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_ms = Column(Float, nullable=False)
    status_code = Column(String(32), default="OK")  # OK, ERROR, UNSET
    status_message = Column(Text, nullable=True)
    attributes_json = Column(JSON, default=dict)
    events_json = Column(JSON, default=list)
    resource_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="spans")

class TraceSummary(Base):
    __tablename__ = "trace_summaries"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    trace_id = Column(String(64), unique=True, index=True, nullable=False)
    application_id = Column(String(36), index=True, nullable=False)
    root_service = Column(String(128), nullable=False)
    root_name = Column(String(255), nullable=False)
    start_time = Column(DateTime, index=True, nullable=False)
    duration_ms = Column(Float, nullable=False)
    span_count = Column(Integer, default=1)
    error_count = Column(Integer, default=0)
    has_error = Column(Boolean, default=False)

# ----------------- Alerting Models -----------------
class AlertRule(Base):
    __tablename__ = "alert_rules"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    metric_type = Column(String(32), nullable=False)  # error_rate, p95_latency, failed_requests, synthetic_failure
    operator = Column(String(8), default="gt")  # gt, gte, lt, lte
    threshold = Column(Float, nullable=False)
    duration_seconds = Column(Integer, default=180)  # Must be breached for duration
    severity = Column(String(32), default="warning")  # info, warning, critical
    state = Column(String(32), default="OK")  # OK, PENDING, FIRING, RESOLVED
    pending_since = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="alert_rules")
    incidents = relationship("Incident", back_populates="alert_rule", cascade="all, delete-orphan")

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    alert_rule_id = Column(String(36), ForeignKey("alert_rules.id", ondelete="CASCADE"), index=True, nullable=False)
    application_id = Column(String(36), index=True, nullable=False)
    team_id = Column(String(36), index=True, nullable=False)
    dedup_key = Column(String(128), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    severity = Column(String(32), nullable=False)
    status = Column(String(32), default="OPEN")  # OPEN, ACKNOWLEDGED, RESOLVED
    current_value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    triggered_at = Column(DateTime, default=utc_now)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    acknowledged_by_user_id = Column(String(36), nullable=True)
    
    alert_rule = relationship("AlertRule", back_populates="incidents")
    notification_logs = relationship("NotificationLog", back_populates="incident", cascade="all, delete-orphan")

class NotificationLog(Base):
    __tablename__ = "notification_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    channel_id = Column(String(36), nullable=True)
    channel_type = Column(String(32), nullable=False)
    status = Column(String(32), default="SENT")  # SENT, FAILED
    payload_json = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=utc_now)
    
    incident = relationship("Incident", back_populates="notification_logs")

# ----------------- Synthetic Check Models -----------------
class SyntheticCheck(Base):
    __tablename__ = "synthetic_checks"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    check_type = Column(String(32), default="http")  # http, multi_step
    url = Column(Text, nullable=False)
    method = Column(String(16), default="GET")
    headers_json = Column(JSON, default=dict)
    body = Column(Text, nullable=True)
    expected_status = Column(Integer, default=200)
    json_assertion = Column(String(255), nullable=True)
    latency_sla_ms = Column(Float, default=1000.0)
    interval_seconds = Column(Integer, default=60)
    timeout_seconds = Column(Integer, default=15)
    retry_count = Column(Integer, default=2)  # fail after 2 out of 3
    status = Column(String(32), default="HEALTHY")  # HEALTHY, DEGRADED, DOWN
    uptime_percent = Column(Float, default=100.0)
    last_run_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="synthetic_checks")
    results = relationship("SyntheticResult", back_populates="check", cascade="all, delete-orphan")
    steps = relationship("SyntheticStep", back_populates="check", cascade="all, delete-orphan")

class SyntheticStep(Base):
    __tablename__ = "synthetic_steps"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    check_id = Column(String(36), ForeignKey("synthetic_checks.id", ondelete="CASCADE"), index=True, nullable=False)
    step_order = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    method = Column(String(16), default="GET")
    url = Column(Text, nullable=False)
    headers_json = Column(JSON, default=dict)
    body = Column(Text, nullable=True)
    extract_variable = Column(String(128), nullable=True)  # e.g. token=data.token
    assertion_json = Column(JSON, default=dict)
    
    check = relationship("SyntheticCheck", back_populates="steps")

class SyntheticResult(Base):
    __tablename__ = "synthetic_results"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    check_id = Column(String(36), ForeignKey("synthetic_checks.id", ondelete="CASCADE"), index=True, nullable=False)
    status = Column(String(32), nullable=False)  # SUCCESS, FAILURE
    status_code = Column(Integer, nullable=True)
    total_duration_ms = Column(Float, default=0.0)
    dns_duration_ms = Column(Float, default=0.0)
    tcp_duration_ms = Column(Float, default=0.0)
    tls_duration_ms = Column(Float, default=0.0)
    ttfb_duration_ms = Column(Float, default=0.0)
    failure_reason = Column(Text, nullable=True)
    response_snippet = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    
    check = relationship("SyntheticCheck", back_populates="results")
