export type ConsentCategory = 'necessary' | 'analytics';

export interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  timestamp: string;
  version: string;
}

const STORAGE_KEY = 'sharespace_cookie_consent_v1';
const CURRENT_VERSION = '1.0.0';

const DEFAULT_PREFERENCES: ConsentPreferences = {
  necessary: true,
  analytics: false,
  timestamp: '',
  version: CURRENT_VERSION,
};

let inMemoryFallback: ConsentPreferences | null = null;

type ConsentListener = (prefs: ConsentPreferences) => void;
const listeners = new Set<ConsentListener>();

export const consentManager = {
  getPreferences(): ConsentPreferences | null {
    if (typeof window === 'undefined') return inMemoryFallback;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ConsentPreferences;
      if (parsed.version !== CURRENT_VERSION) {
        return null;
      }
      return {
        ...parsed,
        necessary: true, // Always true
      };
    } catch {
      return null;
    }
  },

  hasConsent(category: ConsentCategory): boolean {
    if (category === 'necessary') return true;
    const prefs = this.getPreferences();
    return prefs ? Boolean(prefs[category]) : false;
  },

  savePreferences(prefs: { analytics: boolean }) {
    const record: ConsentPreferences = {
      necessary: true,
      analytics: Boolean(prefs.analytics),
      timestamp: new Date().toISOString(),
      version: CURRENT_VERSION,
    };

    if (typeof window === 'undefined') {
      inMemoryFallback = record;
      listeners.forEach((fn) => fn(record));
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn('Could not save consent preferences:', e);
    }
    listeners.forEach((fn) => fn(record));
    window.dispatchEvent(new CustomEvent('sharespace:consent_updated', { detail: record }));
  },

  acceptAll() {
    this.savePreferences({ analytics: true });
  },

  rejectNonEssential() {
    this.savePreferences({ analytics: false });
  },

  subscribe(listener: ConsentListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  openSettings() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sharespace:open_cookie_settings'));
    }
  },
};
