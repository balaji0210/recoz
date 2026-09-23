/**
 * Data privacy scrubber for RicozAppMon RUM SDK.
 * Strips sensitive URL query parameters and masks potential PII.
 */

const SENSITIVE_PARAM_NAMES = [
  'token', 'auth', 'access_token', 'password', 'pwd', 'secret',
  'api_key', 'apikey', 'credit_card', 'cc', 'cvv', 'ssn', 'session'
];

const CC_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function scrubUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl, window.location.origin);
    const searchParams = urlObj.searchParams;
    
    for (const key of Array.from(searchParams.keys())) {
      const lower = key.toLowerCase();
      if (SENSITIVE_PARAM_NAMES.some(s => lower.includes(s))) {
        searchParams.set(key, '[REDACTED]');
      }
    }
    
    urlObj.search = searchParams.toString();
    return urlObj.toString();
  } catch (e) {
    return rawUrl.split('?')[0]; // Safe fallback: strip query string completely
  }
}

export function scrubText(text: string): string {
  if (!text) return '';
  return text
    .replace(CC_REGEX, '[REDACTED_CARD]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
}
