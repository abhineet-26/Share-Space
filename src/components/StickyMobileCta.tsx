import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, X } from 'lucide-react';

export const StickyMobileCta: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show only after scrolling down 240px
      if (window.scrollY > 240) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div
      role="complementary"
      aria-label="Quick demo access call to action"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 p-3 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-color)] shadow-xl pb-[calc(12px+env(safe-area-inset-bottom))] transition-transform duration-200 ease-out"
    >
      <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--text-primary)] truncate">
              Ready to test SHARESPACE?
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] truncate">
              Interactive 11-step demo personas
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] shadow-sm hover:bg-[var(--brand-hover)] transition-colors"
          >
            <span>Explore Demo</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-[4px] cursor-pointer"
            aria-label="Dismiss quick demo banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
