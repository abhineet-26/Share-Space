import React from 'react';
import { Resource } from '../lib/types';

interface Props {
  type: Resource['illustrationType'];
  className?: string;
}

export const ResourceIllustration: React.FC<Props> = ({ type, className = 'w-full h-36' }) => {
  const normType = (type || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return (
    <div
      className={`flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[6px] overflow-hidden select-none ${className}`}
      role="img"
      aria-label={`Technical schematic illustration for ${type ? String(type).replace('_', ' ') : 'resource'}`}
    >
      <svg
        viewBox="0 0 240 120"
        className="w-full h-full max-w-[240px] max-h-[120px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle technical grid reference lines */}
        <line x1="16" y1="104" x2="224" y2="104" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
        <line x1="16" y1="16" x2="224" y2="16" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />

        {normType.includes('oscilloscope') && (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="34" y="22" width="172" height="76" rx="4" fill="var(--bg-surface)" />
            <rect x="44" y="30" width="98" height="52" rx="2" />
            {/* Graticule & Sine wave */}
            <line x1="44" y1="56" x2="142" y2="56" strokeOpacity="0.25" strokeDasharray="2 2" />
            <line x1="93" y1="30" x2="93" y2="82" strokeOpacity="0.25" strokeDasharray="2 2" />
            <path
              d="M 48 56 Q 60 34, 72 56 T 96 56 T 120 56 T 138 56"
              stroke="var(--brand-primary)"
              strokeWidth="2"
              fill="none"
            />
            {/* Knobs and BNC ports */}
            <circle cx="160" cy="40" r="6" />
            <circle cx="184" cy="40" r="6" />
            <circle cx="160" cy="60" r="5" />
            <circle cx="184" cy="60" r="5" />
            <circle cx="156" cy="84" r="3.5" />
            <circle cx="170" cy="84" r="3.5" />
            <circle cx="184" cy="84" r="3.5" />
            <circle cx="198" cy="84" r="3.5" />
          </g>
        )}

        {(normType.includes('printer') || normType.includes('3d')) && (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="64" y="18" width="112" height="84" rx="4" fill="var(--bg-surface)" />
            <line x1="76" y1="26" x2="76" y2="90" />
            <line x1="164" y1="26" x2="164" y2="90" />
            <line x1="76" y1="48" x2="164" y2="48" />
            {/* Extruder head */}
            <rect x="110" y="40" width="20" height="16" rx="2" fill="var(--bg-secondary)" />
            <path d="M 116 56 L 124 56 L 120 62 Z" fill="var(--brand-primary)" />
            {/* Printed object on bed */}
            <rect x="98" y="68" width="44" height="16" rx="1" stroke="var(--brand-primary)" />
            <line x1="84" y1="84" x2="156" y2="84" strokeWidth="2.5" />
          </g>
        )}

        {(normType.includes('camera') || normType.includes('tripod')) && (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="58" y="34" width="124" height="62" rx="6" fill="var(--bg-surface)" />
            <path d="M 92 34 L 100 22 L 140 22 L 148 34" fill="var(--bg-surface)" />
            <circle cx="120" cy="65" r="22" />
            <circle cx="120" cy="65" r="14" stroke="var(--brand-primary)" />
            <rect x="68" y="42" width="14" height="8" rx="1" />
            <circle cx="166" cy="46" r="4" />
          </g>
        )}

        {(normType.includes('soldering') || normType.includes('solder')) && (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="44" y="42" width="76" height="54" rx="4" fill="var(--bg-surface)" />
            <rect x="56" y="52" width="52" height="20" rx="2" />
            <text x="64" y="66" fontSize="11" fontFamily="monospace" fill="var(--brand-primary)" stroke="none">
              350°C
            </text>
            <circle cx="82" cy="84" r="5" />
            {/* Soldering handpiece on stand */}
            <path d="M 140 88 L 188 32" strokeWidth="3" strokeLinecap="round" />
            <path d="M 134 94 L 144 84" stroke="var(--brand-primary)" strokeWidth="2" />
            <path d="M 120 96 L 176 96" strokeWidth="2" />
          </g>
        )}

        {(normType.includes('powersupply') || (normType.includes('power') && !normType.includes('workstation'))) && (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="40" y="28" width="160" height="66" rx="4" fill="var(--bg-surface)" />
            <rect x="52" y="38" width="84" height="32" rx="2" />
            <text x="60" y="53" fontSize="10" fontFamily="monospace" fill="var(--brand-primary)" stroke="none">
              15.0V  1.20A
            </text>
            <text x="60" y="65" fontSize="10" fontFamily="monospace" fill="currentColor" stroke="none">
              05.0V  0.45A
            </text>
            <circle cx="154" cy="48" r="6" />
            <circle cx="178" cy="48" r="6" />
            <circle cx="150" cy="78" r="4" stroke="var(--status-danger)" />
            <circle cx="166" cy="78" r="4" />
            <circle cx="182" cy="78" r="4" stroke="var(--brand-primary)" />
          </g>
        )}

        {(normType.includes('multimeter') || normType.includes('dmm')) && (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="82" y="16" width="76" height="88" rx="6" fill="var(--bg-surface)" />
            <rect x="92" y="26" width="56" height="24" rx="2" />
            <text x="98" y="42" fontSize="11" fontFamily="monospace" fill="var(--brand-primary)" stroke="none">
              4.998 V
            </text>
            <circle cx="120" cy="70" r="14" />
            <line x1="120" y1="70" x2="128" y2="62" stroke="var(--brand-primary)" strokeWidth="2" />
            <circle cx="102" cy="94" r="3" />
            <circle cx="120" cy="94" r="3" />
            <circle cx="138" cy="94" r="3" stroke="var(--status-danger)" />
          </g>
        )}

        {normType.includes('lighting') && (
          <g stroke="currentColor" strokeWidth="1.5">
            {/* Softbox & tripod */}
            <polygon points="90,26 150,20 150,64 90,58" fill="var(--bg-surface)" />
            <line x1="120" y1="61" x2="120" y2="98" strokeWidth="2" />
            <line x1="120" y1="82" x2="94" y2="100" />
            <line x1="120" y1="82" x2="146" y2="100" />
            <line x1="158" y1="32" x2="174" y2="26" stroke="var(--brand-primary)" />
            <line x1="160" y1="42" x2="178" y2="42" stroke="var(--brand-primary)" />
            <line x1="158" y1="52" x2="174" y2="58" stroke="var(--brand-primary)" />
          </g>
        )}

        {(normType.includes('workstation') || normType.includes('gpu')) && (
          <g stroke="currentColor" strokeWidth="1.5">
            {/* Monitor + GPU Tower */}
            <rect x="42" y="26" width="96" height="58" rx="3" fill="var(--bg-surface)" />
            <line x1="90" y1="84" x2="90" y2="96" />
            <line x1="72" y1="96" x2="108" y2="96" />
            <rect x="150" y="22" width="46" height="74" rx="3" fill="var(--bg-surface)" />
            <line x1="158" y1="34" x2="188" y2="34" stroke="var(--brand-primary)" />
            <line x1="158" y1="42" x2="188" y2="42" stroke="var(--brand-primary)" />
            <circle cx="173" cy="64" r="9" />
            <circle cx="173" cy="84" r="4" />
          </g>
        )}

        {(normType.includes('room') || normType.includes('project') || normType.includes('meeting')) && (
          <g stroke="currentColor" strokeWidth="1.5">
            {/* Architectural room plan schematic */}
            <rect x="44" y="22" width="152" height="76" rx="2" fill="var(--bg-surface)" />
            <rect x="78" y="42" width="84" height="36" rx="3" stroke="var(--brand-primary)" />
            {/* Chairs around worktable */}
            <rect x="90" y="34" width="16" height="4" rx="1" />
            <rect x="134" y="34" width="16" height="4" rx="1" />
            <rect x="90" y="82" width="16" height="4" rx="1" />
            <rect x="134" y="82" width="16" height="4" rx="1" />
            {/* Wall display */}
            <line x1="48" y1="44" x2="48" y2="76" strokeWidth="3" stroke="var(--brand-primary)" />
          </g>
        )}

        {(normType.includes('laser') || normType.includes('cnc')) && (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="38" y="28" width="164" height="66" rx="4" fill="var(--bg-surface)" />
            <rect x="50" y="38" width="112" height="46" rx="2" />
            <line x1="50" y1="58" x2="162" y2="58" stroke="var(--brand-primary)" />
            <circle cx="106" cy="58" r="5" fill="var(--brand-primary)" />
            <rect x="172" y="40" width="20" height="28" rx="2" />
          </g>
        )}
      </svg>
    </div>
  );
};
