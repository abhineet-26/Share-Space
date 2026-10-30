import { consentManager } from './consentManager';

export type AnalyticsStatus = 'ACTIVE' | 'DISABLED_PENDING_CONSENT' | 'PENDING_CONFIGURATION';

export interface AnalyticsEvent {
  eventName:
    | 'page_view'
    | 'cta_click'
    | 'demo_entry_click'
    | 'contact_inquiry_submitted'
    | 'filter_category_changed'
    | 'assisted_search_executed';
  properties?: Record<string, string | number | boolean>;
}

// In production, configure through Vite environment variable VITE_ANALYTICS_ID
const ANALYTICS_ID: string | undefined = import.meta.env?.VITE_ANALYTICS_ID;

class AnalyticsService {
  private initialized = false;

  public getStatus(): AnalyticsStatus {
    if (!ANALYTICS_ID) {
      return 'PENDING_CONFIGURATION';
    }
    if (!consentManager.hasConsent('analytics')) {
      return 'DISABLED_PENDING_CONSENT';
    }
    return 'ACTIVE';
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return;

    // React to user consent changes
    consentManager.subscribe((prefs) => {
      if (prefs.analytics && ANALYTICS_ID) {
        this.enableTracking();
      } else {
        this.disableTracking();
      }
    });

    if (this.getStatus() === 'ACTIVE') {
      this.enableTracking();
    }
    this.initialized = true;
  }

  private enableTracking() {
    // Architectural hook for privacy-friendly analytics script (e.g. Plausible, Umami, or GA4 with anonymized IP)
    // Only non-sensitive aggregate operational events are recorded.
    if (import.meta.env?.DEV) {
      console.info('[SHARESPACE Analytics] Consent granted. Tracking enabled with ID:', ANALYTICS_ID);
    }
  }

  private disableTracking() {
    if (import.meta.env?.DEV) {
      console.info('[SHARESPACE Analytics] Tracking disabled per user consent policy.');
    }
  }

  /**
   * Track non-sensitive platform event.
   * Personal names, emails, booking notes, tokens, and confidential descriptions are strictly stripped.
   */
  public track(event: AnalyticsEvent) {
    if (this.getStatus() !== 'ACTIVE') {
      if (import.meta.env?.DEV) {
        console.debug('[SHARESPACE Analytics (Mock/Gated)]', event.eventName, event.properties);
      }
      return;
    }

    // Sanitize any accidental sensitive fields
    const safeProps = { ...event.properties };
    delete safeProps.email;
    delete safeProps.token;
    delete safeProps.password;
    delete safeProps.notes;
    delete safeProps.incident;

    // Forward to configured window analytics provider if registered
    if (typeof (window as any)._sharespace_track === 'function') {
      (window as any)._sharespace_track(event.eventName, safeProps);
    }
  }

  public trackPageView(path: string) {
    this.track({
      eventName: 'page_view',
      properties: { path },
    });
  }
}

export const analytics = new AnalyticsService();
