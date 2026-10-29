import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = parseISO(isoString);
    if (!isValid(d)) return isoString;
    return format(d, 'dd MMM yyyy, HH:mm');
  } catch {
    return isoString;
  }
}

export function formatShortDate(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = parseISO(isoString);
    if (!isValid(d)) return isoString;
    return format(d, 'dd MMM yyyy');
  } catch {
    return isoString;
  }
}

export function formatTimeRange(startIso: string, endIso: string): string {
  try {
    const s = parseISO(startIso);
    const e = parseISO(endIso);
    if (!isValid(s) || !isValid(e)) return `${startIso} – ${endIso}`;
    const sameDay = format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd');
    if (sameDay) {
      return `${format(s, 'EEE, dd MMM yyyy · HH:mm')} – ${format(e, 'HH:mm')}`;
    }
    return `${format(s, 'dd MMM HH:mm')} – ${format(e, 'dd MMM HH:mm')}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
}

export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = parseISO(isoString);
    if (!isValid(d)) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

export function getDurationHours(startIso: string, endIso: string): number {
  try {
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return 0;
    return Math.round(((e - s) / (1000 * 60 * 60)) * 100) / 100;
  } catch {
    return 0;
  }
}

export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalJson(record[k]))
      .join(',') +
    '}'
  );
}

export async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const byteArray = Array.from(new Uint8Array(digest));
    return byteArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic FNV-inspired 64-char hex if crypto.subtle unavailable
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  return part.repeat(4);
}

export async function computeLedgerEventHash(params: {
  prevHash: string;
  organizationId: string;
  seq: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  reason?: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const payload = canonicalJson({
    organizationId: params.organizationId,
    seq: params.seq,
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    occurredAt: params.occurredAt,
    reason: params.reason || '',
    metadata: params.metadata || {},
  });
  return sha256Hex(`${params.prevHash}||${payload}`);
}

export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
