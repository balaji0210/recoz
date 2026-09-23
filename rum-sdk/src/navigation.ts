import { RUMEventPayload, Breadcrumb } from './types';
import { scrubUrl } from './scrubber';

export class NavigationTracker {
  private emit: (data: Partial<RUMEventPayload>) => void;
  private recordBreadcrumb: (b: Breadcrumb) => void;
  private currentRoute: string;

  constructor(
    emit: (data: Partial<RUMEventPayload>) => void,
    recordBreadcrumb: (b: Breadcrumb) => void
  ) {
    this.emit = emit;
    this.recordBreadcrumb = recordBreadcrumb;
    this.currentRoute = window.location.pathname;

    this.trackInitialPageView();
    this.patchHistoryApi();
  }

  private trackInitialPageView(): void {
    const url = scrubUrl(window.location.href);
    this.emit({
      event_type: 'page_view',
      url,
      route: this.currentRoute
    });
    this.recordBreadcrumb({
      type: 'navigation',
      category: 'pageview',
      message: `Initial page view to ${this.currentRoute}`,
      timestamp: Date.now()
    });
  }

  private patchHistoryApi(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const self = this;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      self.handleRouteChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      self.handleRouteChange();
    };

    window.addEventListener('popstate', () => {
      this.handleRouteChange();
    });
  }

  private handleRouteChange(): void {
    const newRoute = window.location.pathname;
    if (newRoute !== this.currentRoute) {
      const from = this.currentRoute;
      this.currentRoute = newRoute;
      const url = scrubUrl(window.location.href);

      this.emit({
        event_type: 'route_change',
        url,
        route: newRoute,
        metadata: { from_route: from, to_route: newRoute }
      });

      this.recordBreadcrumb({
        type: 'navigation',
        category: 'spa_route',
        message: `Navigated from ${from} to ${newRoute}`,
        timestamp: Date.now()
      });
    }
  }
}
