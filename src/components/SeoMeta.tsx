import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface SeoMetaProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  robots?: 'index, follow' | 'noindex, nofollow' | 'noindex, follow';
  ogType?: 'website' | 'article';
  ogImage?: string;
}

const PRODUCTION_ORIGIN = 'https://sharespace-frontend-ayd4.onrender.com';
const DEFAULT_DESCRIPTION =
  'Access more. Waste less. Build together. Institutional resource accountability platform with policy-driven eligibility, handover condition tracking, and tamper-evident Trust Ledger.';
const DEFAULT_OG_IMAGE = `${PRODUCTION_ORIGIN}/og-image.png`;

export function useSeoMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  robots = 'index, follow',
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
}: SeoMetaProps) {
  const location = useLocation();
  const currentPath = canonicalPath || location.pathname;
  const canonicalUrl = `${PRODUCTION_ORIGIN}${currentPath === '/' ? '' : currentPath}`;

  useEffect(() => {
    // 1. Update Title
    const formattedTitle = title.includes('SHARESPACE') ? title : `${title} | SHARESPACE`;
    document.title = formattedTitle;

    // Helper to get or create a meta tag
    const setMetaTag = (attr: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, key);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper to get or create a link tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // 2. Standard Meta
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'robots', robots);

    // 3. Canonical URL
    setLinkTag('canonical', canonicalUrl);

    // 4. Open Graph Meta
    setMetaTag('property', 'og:title', formattedTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:site_name', 'SHARESPACE');

    // 5. Twitter / X Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', formattedTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);
  }, [title, description, canonicalUrl, robots, ogType, ogImage]);
}

export const SeoMeta: React.FC<SeoMetaProps> = (props) => {
  useSeoMeta(props);
  return null;
};
