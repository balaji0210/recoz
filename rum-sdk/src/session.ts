const SESSION_STORAGE_KEY = 'rz_rum_session_id';
const SESSION_TIMESTAMP_KEY = 'rz_rum_session_last_active';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class SessionManager {
  private sessionId: string;

  constructor() {
    this.sessionId = this.getOrCreateSession();
    this.attachActivityListeners();
  }

  public getSessionId(): string {
    const now = Date.now();
    const lastActive = parseInt(sessionStorage.getItem(SESSION_TIMESTAMP_KEY) || '0', 10);
    
    if (now - lastActive > IDLE_TIMEOUT_MS) {
      // Idle timeout expired: create fresh session ID
      this.sessionId = generateUUID();
      sessionStorage.setItem(SESSION_STORAGE_KEY, this.sessionId);
    }
    
    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());
    return this.sessionId;
  }

  private getOrCreateSession(): string {
    try {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const lastActive = parseInt(sessionStorage.getItem(SESSION_TIMESTAMP_KEY) || '0', 10);
      const now = Date.now();

      if (existing && now - lastActive <= IDLE_TIMEOUT_MS) {
        sessionStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());
        return existing;
      }

      const newId = generateUUID();
      sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());
      return newId;
    } catch (e) {
      return generateUUID();
    }
  }

  private attachActivityListeners(): void {
    const refresh = () => {
      try {
        sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
      } catch (e) {}
    };

    ['click', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      window.addEventListener(event, refresh, { passive: true });
    });
  }

  public static getClientInfo(): { browser: string; os: string; device: string; user_agent: string } {
    const ua = navigator.userAgent;
    let browser = 'Other';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Other';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    let device = 'Desktop';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
      device = /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Mobile';
    }

    return { browser, os, device, user_agent: ua };
  }
}
