import { RUMEventPayload, Breadcrumb } from './types';
import { scrubText, scrubUrl } from './scrubber';

export class ErrorTracker {
  private emit: (data: Partial<RUMEventPayload>) => void;
  private getBreadcrumbs: () => Breadcrumb[];
  private recordBreadcrumb: (b: Breadcrumb) => void;
  private releaseVersion: string;

  constructor(
    emit: (data: Partial<RUMEventPayload>) => void,
    getBreadcrumbs: () => Breadcrumb[],
    recordBreadcrumb: (b: Breadcrumb) => void,
    releaseVersion: string = '1.0.0'
  ) {
    this.emit = emit;
    this.getBreadcrumbs = getBreadcrumbs;
    this.recordBreadcrumb = recordBreadcrumb;
    this.releaseVersion = releaseVersion;

    this.attachErrorListeners();
    this.attachClickBreadcrumbs();
  }

  private attachErrorListeners(): void {
    // 1. Unhandled Window Errors
    window.addEventListener('error', (event) => {
      try {
        const error = event.error || {};
        const errorType = error.name || 'JavaScriptError';
        const message = scrubText(event.message || error.message || 'Unknown uncaught error');
        const stack = error.stack || `at ${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`;

        this.emit({
          event_type: 'error',
          error_type: errorType,
          message,
          stack,
          release_version: this.releaseVersion,
          breadcrumbs: this.getBreadcrumbs()
        });
      } catch (e) {}
    });

    // 2. Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
      try {
        const reason = event.reason;
        let errorType = 'UnhandledPromiseRejection';
        let message = 'Promise rejected without handler';
        let stack = '';

        if (reason instanceof Error) {
          errorType = reason.name || errorType;
          message = scrubText(reason.message || message);
          stack = reason.stack || '';
        } else if (typeof reason === 'string') {
          message = scrubText(reason);
        }

        this.emit({
          event_type: 'error',
          error_type: errorType,
          message,
          stack,
          release_version: this.releaseVersion,
          breadcrumbs: this.getBreadcrumbs()
        });
      } catch (e) {}
    });
  }

  private attachClickBreadcrumbs(): void {
    window.addEventListener('click', (event) => {
      try {
        const target = event.target as HTMLElement;
        if (!target) return;

        const tagName = target.tagName ? target.tagName.toLowerCase() : '';
        if (['button', 'a', 'input', 'select'].includes(tagName) || target.getAttribute('role') === 'button') {
          const text = target.innerText ? target.innerText.slice(0, 30).trim() : '';
          const id = target.id ? `#${target.id}` : '';
          const cls = target.className && typeof target.className === 'string' ? `.${target.className.split(' ')[0]}` : '';

          this.recordBreadcrumb({
            type: 'click',
            category: 'ui',
            message: `Clicked <${tagName}${id}${cls}> "${text}"`,
            timestamp: Date.now()
          });
        }
      } catch (e) {}
    }, { passive: true });
  }
}
