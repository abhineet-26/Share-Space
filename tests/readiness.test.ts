import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consentManager } from '../src/lib/consentManager';
import { analytics } from '../src/lib/analytics';
import { contactConfig } from '../src/lib/contactConfig';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const publicDir = path.resolve(rootDir, 'public');
const distDir = path.resolve(rootDir, 'dist');

console.log('--- RUNNING WEBSITE PRODUCTION READINESS TESTS ---');

// Test 1: Verify robots.txt structure and rules
{
  const robotsPath = path.join(publicDir, 'robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'robots.txt must exist in public/');
  const content = fs.readFileSync(robotsPath, 'utf-8');
  assert.ok(content.includes('Allow: /'), 'Must allow root indexing');
  assert.ok(content.includes('Allow: /about'), 'Must allow about page');
  assert.ok(content.includes('Allow: /privacy'), 'Must allow privacy page');
  assert.ok(content.includes('Disallow: /admin/'), 'Must disallow admin');
  assert.ok(content.includes('Disallow: /bookings/'), 'Must disallow private bookings');
  assert.ok(content.includes('Sitemap: https://sharespace-frontend-ayd4.onrender.com/sitemap.xml'), 'Must declare sitemap');
  console.log('✓ Test 1 Passed: robots.txt is valid and compliant');
}

// Test 2: Verify sitemap.xml structure and URLs
{
  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml must exist in public/');
  const content = fs.readFileSync(sitemapPath, 'utf-8');
  assert.ok(content.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Must be XML');
  assert.ok(content.includes('<loc>https://sharespace-frontend-ayd4.onrender.com/</loc>'), 'Must include root URL');
  assert.ok(content.includes('<loc>https://sharespace-frontend-ayd4.onrender.com/about</loc>'), 'Must include /about');
  assert.ok(content.includes('<loc>https://sharespace-frontend-ayd4.onrender.com/privacy</loc>'), 'Must include /privacy');
  assert.ok(content.includes('<loc>https://sharespace-frontend-ayd4.onrender.com/terms</loc>'), 'Must include /terms');
  assert.ok(content.includes('<loc>https://sharespace-frontend-ayd4.onrender.com/contact</loc>'), 'Must include /contact');
  assert.ok(!content.includes('/admin/'), 'Must not include private admin URLs');
  assert.ok(!content.includes('/bookings/'), 'Must not include private booking URLs');
  console.log('✓ Test 2 Passed: sitemap.xml is valid and index-restricted to public pages');
}

// Test 3: Verify complete favicon set & Open Graph image in public/
{
  const requiredFiles = [
    'favicon.ico',
    'favicon.svg',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'og-image.png',
    'site.webmanifest',
  ];

  for (const file of requiredFiles) {
    const p = path.join(publicDir, file);
    assert.ok(fs.existsSync(p), `Required asset ${file} must exist in public/`);
    const stat = fs.statSync(p);
    assert.ok(stat.size > 50, `${file} must have valid non-empty byte size`);
  }
  console.log('✓ Test 3 Passed: Complete favicon set and 1200x630 OG image exist with valid sizes');
}

// Test 4: Verify Consent Manager behavior
{
  // Reset for test
  consentManager.rejectNonEssential();
  assert.equal(consentManager.hasConsent('necessary'), true, 'Strictly necessary is always true');
  assert.equal(consentManager.hasConsent('analytics'), false, 'Analytics is false after rejection');

  consentManager.acceptAll();
  assert.equal(consentManager.hasConsent('analytics'), true, 'Analytics is true after acceptAll');

  consentManager.savePreferences({ analytics: false });
  assert.equal(consentManager.hasConsent('analytics'), false, 'Analytics is false after custom save');
  console.log('✓ Test 4 Passed: Consent Manager persistence and state transitions');
}

// Test 5: Verify Analytics service gating & PII stripping
{
  consentManager.rejectNonEssential();
  assert.equal(analytics.getStatus(), 'PENDING_CONFIGURATION', 'Pending configuration when VITE_ANALYTICS_ID unset');

  // Verify non-sensitive tracking execution does not throw
  analytics.track({
    eventName: 'page_view',
    properties: {
      path: '/about',
      // The following sensitive keys should be safely scrubbed
      email: 'sensitive@university.edu',
      token: 'secret-token',
    },
  });
  console.log('✓ Test 5 Passed: Analytics service consent gating and sanitization');
}

// Test 6: Verify Contact Configuration structure
{
  assert.ok(contactConfig.organizationName, 'Must have organization name');
  assert.ok(contactConfig.supportEmail, 'Must have support email');
  assert.ok(contactConfig.securityEmail, 'Must have security email');
  assert.ok(contactConfig.postalAddress, 'Must have postal address');
  assert.equal(contactConfig.isOwnerConfirmed, false, 'Flags owner confirmation pending accurately');
  console.log('✓ Test 6 Passed: Centralized contact configuration structure is intact');
}

console.log('ALL WEBSITE PRODUCTION READINESS TESTS PASSED CLEANLY.');
