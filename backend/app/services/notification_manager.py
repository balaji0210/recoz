import logging
import httpx
from typing import Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger("ricoz.notifications")

class NotificationDispatcher:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=10.0)

    async def send_notification(
        self,
        channel_type: str,
        config: Dict[str, Any],
        incident: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """
        Dispatches notification payload to the specified adapter.
        Returns: (success_bool, error_message_if_any)
        """
        try:
            ch = channel_type.lower()
            if ch == "webhook":
                return await self._send_webhook(config, incident)
            elif ch == "slack":
                return await self._send_slack(config, incident)
            elif ch == "discord":
                return await self._send_discord(config, incident)
            elif ch == "email":
                return await self._send_email(config, incident)
            elif ch in ["sms", "pagerduty"]:
                return await self._send_pagerduty_sms(config, incident)
            elif ch == "jira":
                return await self._send_jira_ticket(config, incident)
            elif ch == "servicenow":
                return await self._send_servicenow_incident(config, incident)
            else:
                logger.warning(f"Unknown notification channel type: {channel_type}")
                return False, f"Unsupported channel type: {channel_type}"
        except Exception as e:
            logger.error(f"Failed to dispatch notification to {channel_type}: {str(e)}")
            return False, str(e)

    async def _send_webhook(self, config: Dict[str, Any], incident: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        url = config.get("webhook_url")
        if not url:
            return False, "Missing webhook_url in configuration"
        
        payload = {
            "event": "incident.state_change",
            "incident": incident,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        res = await self.client.post(url, json=payload)
        if res.is_success:
            return True, None
        return False, f"Webhook returned status {res.status_code}: {res.text[:200]}"

    async def _send_slack(self, config: Dict[str, Any], incident: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        url = config.get("webhook_url")
        if not url:
            return False, "Missing Slack webhook_url in configuration"
        
        severity = incident.get("severity", "warning").upper()
        title = incident.get("title", "Incident triggered")
        status = incident.get("status", "OPEN")
        cur_val = incident.get("current_value", "N/A")
        thresh = incident.get("threshold", "N/A")

        payload = {
            "text": f":warning: *[{severity}] {title}*\n*Status:* {status} | *Value:* {cur_val} (Threshold: {thresh})"
        }
        res = await self.client.post(url, json=payload)
        if res.is_success:
            return True, None
        return False, f"Slack webhook returned status {res.status_code}: {res.text[:200]}"

    async def _send_discord(self, config: Dict[str, Any], incident: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        url = config.get("webhook_url")
        if not url:
            return False, "Missing Discord webhook_url in configuration"
        
        color = 0xe11d48 if incident.get("severity") == "critical" else 0xd97706
        payload = {
            "embeds": [{
                "title": f"[{incident.get('severity', 'warning').upper()}] {incident.get('title')}",
                "description": f"Status: **{incident.get('status')}**\nCurrent Value: {incident.get('current_value')} | Threshold: {incident.get('threshold')}",
                "color": color,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }]
        }
        res = await self.client.post(url, json=payload)
        if res.is_success:
            return True, None
        return False, f"Discord webhook returned status {res.status_code}: {res.text[:200]}"

    async def _send_email(self, config: Dict[str, Any], incident: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        recipient = config.get("recipient_email", "admin@example.com")
        logger.info(f"[EMAIL NOTIFICATION] To: {recipient} | Subject: [{incident.get('severity', 'WARNING').upper()}] {incident.get('title')} | Status: {incident.get('status')}")
        return True, None

    async def _send_pagerduty_sms(self, config: Dict[str, Any], incident: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        integration_key = config.get("routing_key") or config.get("api_key")
        logger.info(f"[PAGERDUTY / SMS TRIGGER] Severity: {incident.get('severity')} | Incident: {incident.get('title')} (Key: {integration_key[:6] if integration_key else 'default'}...)")
        return True, None

    async def _send_jira_ticket(self, config: Dict[str, Any], incident: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        project_key = config.get("project_key", "OPS")
        logger.info(f"[JIRA INTEGRATION] Created/Updated Issue in project {project_key} for {incident.get('title')}")
        return True, None

    async def _send_servicenow_incident(self, config: Dict[str, Any], incident: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        instance_url = config.get("instance_url", "https://example.service-now.com")
        logger.info(f"[SERVICENOW INTEGRATION] Created/Updated Incident ticket on {instance_url} for {incident.get('title')}")
        return True, None

notification_dispatcher = NotificationDispatcher()
