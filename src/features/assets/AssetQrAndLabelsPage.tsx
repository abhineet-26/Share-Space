import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QrCode, Printer, ArrowLeft, ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Asset, Resource } from '../../lib/types';
import { QrCodeMatrix } from '../../components/QrCodeMatrix';
import { StatusIndicator } from '../../components/Primitives';

export const AssetScanLandingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useApp();

  const [manualToken, setManualToken] = useState(token || 'qr_nit_osc_001_9f8a7b');
  const [scanResult, setScanResult] = useState<{
    asset: Asset;
    resource: Resource;
    allowedActions: Array<{
      type: 'CHECK_IN' | 'RETURN' | 'STAFF_CONFIRM_RETURN' | 'VIEW_RESOURCE';
      label: string;
      bookingId?: string;
      description: string;
    }>;
    explanation: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const runScan = async () => {
      const targetToken = token || 'qr_nit_osc_001_9f8a7b';
      setManualToken(targetToken);
      setLoading(true);
      setError('');
      try {
        const res = await api.scanAssetQr(targetToken);
        if (active) setScanResult(res);
      } catch (err) {
        if (active) {
          setScanResult(null);
          setError(err instanceof Error ? err.message : 'Asset QR token not found.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    runScan();
    return () => {
      active = false;
    };
  }, [token, user]);

  const demoTokens = [
    { label: 'Digital Oscilloscope (Approved for Aarav)', token: 'qr_nit_osc_001_9f8a7b' },
    { label: 'Bench Power Supply (Checked out to Aarav)', token: 'qr_nit_psu_001_3b4a9c' },
    { label: 'Multimeter Kit (Return pending confirm)', token: 'qr_nit_dmm_001_2d8e4f' },
    { label: 'Prusa MK4S 3D Printer', token: 'qr_nit_3dp_001_4c2d1e' },
  ];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4 space-y-1">
        <div className="text-xs font-mono-tech text-[var(--brand-primary)]">
          AUTHENTICATED ASSET QR HANDOVER
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Asset QR scan & contextual actions
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          QR tokens contain no personal data and never grant access by themselves. Only actions permitted for your signed-in identity and active bookings are unlocked below.
        </p>
      </div>

      {/* Token Switcher / Manual Entry */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualToken.trim()) {
            navigate(`/assets/scan/${encodeURIComponent(manualToken.trim())}`);
          }
        }}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-3"
      >
        <label
          htmlFor="qr-token-input"
          className="block text-xs font-semibold text-[var(--text-primary)]"
        >
          Enter or switch physical asset QR token
        </label>
        <div className="flex gap-2">
          <input
            id="qr-token-input"
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="flex-1 px-3 py-2 text-xs font-mono-tech bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] cursor-pointer"
          >
            Resolve QR
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {demoTokens.map((dt) => (
            <button
              key={dt.token}
              type="button"
              onClick={() => navigate(`/assets/scan/${dt.token}`)}
              className={`px-2.5 py-1 text-[11px] rounded-[4px] border cursor-pointer ${
                token === dt.token
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-subtle)] text-[var(--brand-primary)] font-semibold'
                  : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)]'
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>
      </form>

      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Resolving QR token...</div>
      ) : error || !scanResult ? (
        <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger)]/30 rounded-[8px] p-5 text-xs text-[var(--status-danger)] space-y-2">
          <div className="font-semibold">Unrecognised or cross-tenant QR token</div>
          <p>{error}</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-[var(--border-color)] pb-4">
            <QrCodeMatrix token={scanResult.asset.qrToken} size={112} showTokenLabel={false} />
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-xs font-mono-tech text-[var(--text-secondary)]">
                Asset Tag: <strong>{scanResult.asset.assetTag}</strong> · SN:{' '}
                {scanResult.asset.serialNumber}
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {scanResult.resource.name}
              </h2>
              <div className="text-xs text-[var(--text-secondary)]">
                {scanResult.resource.location}
              </div>
              <div className="pt-1 flex flex-wrap justify-center sm:justify-start gap-2">
                <StatusIndicator kind="condition" value={scanResult.asset.condition} />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-[6px] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)]">
            {scanResult.explanation}
          </div>

          {/* Context-Allowed Actions (44x44px touch targets) */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">
              Permitted actions for {user?.name} right now:
            </div>
            {scanResult.allowedActions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (act.type === 'CHECK_IN' && act.bookingId) {
                    navigate(`/bookings/${act.bookingId}/check-in`);
                  } else if (act.type === 'RETURN' && act.bookingId) {
                    navigate(`/bookings/${act.bookingId}/return`);
                  } else if (act.type === 'STAFF_CONFIRM_RETURN') {
                    navigate('/handover');
                  } else {
                    navigate(`/resources/${scanResult.resource.id}`);
                  }
                }}
                className={`w-full p-3.5 rounded-[8px] border text-left flex items-center justify-between gap-3 cursor-pointer min-h-[48px] ${
                  idx === 0 && act.type !== 'VIEW_RESOURCE'
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">{act.label}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      idx === 0 && act.type !== 'VIEW_RESOURCE'
                        ? 'opacity-90'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {act.description}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const PrintableQrLabelSheetPage: React.FC = () => {
  const { resourceId } = useParams<{ resourceId: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    if (!resourceId) return;
    api.getResource(resourceId).then((res) => {
      setResource(res.resource);
      setAssets(res.assets);
    });
  }, [resourceId]);

  if (!resource) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading QR label sheet...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <Link
            to={`/resources/${resource.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {resource.name}</span>
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            Printable asset QR label sheet
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Affix these labels to instrument enclosures or room plaques. Scanning routes authenticated users to check-in or return.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print label sheet</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((ast) => (
          <div
            key={ast.id}
            className="bg-[var(--bg-surface)] border-2 border-[var(--border-color)] rounded-[8px] p-5 flex flex-col items-center text-center space-y-3"
          >
            <div className="text-[11px] font-mono-tech font-bold text-[var(--brand-primary)]">
              SHARESPACE · ACCOUNTABLE ASSET
            </div>
            <QrCodeMatrix token={ast.qrToken} size={148} showTokenLabel={true} />
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-[var(--text-primary)]">{resource.name}</div>
              <div className="text-xs font-mono-tech text-[var(--text-secondary)]">
                Tag: {ast.assetTag} · SN: {ast.serialNumber}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">{resource.location}</div>
            </div>
            <Link
              to={`/assets/scan/${ast.qrToken}`}
              className="no-print text-xs text-[var(--brand-primary)] font-medium hover:underline"
            >
              Simulate scan of this label →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
