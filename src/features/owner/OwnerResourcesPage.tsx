import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Plus, QrCode, ArrowLeft, Wrench, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import {
  Asset,
  ConditionLevel,
  Resource,
  ResourceCategory,
  ResourceStatus,
  SupervisionLevel,
} from '../../lib/types';
import { ConfirmActionDialog, StatusIndicator } from '../../components/Primitives';

export const OwnerResourcesPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, showToast } = useApp();

  const isCreateMode = location.pathname.endsWith('/new');
  const isEditMode = Boolean(id && location.pathname.endsWith('/edit'));

  const [resources, setResources] = useState<Resource[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Form fields for Create / Edit
  const [name, setName] = useState('Benchtop Logic Analyzer (Saleae Pro 16)');
  const [modelNumber, setModelNumber] = useState('SALEAE-PRO16-USB3');
  const [department, setDepartment] = useState('Electrical & Electronics Engineering');
  const [category, setCategory] = useState<ResourceCategory>('ELECTRONICS');
  const [illustrationType, setIllustrationType] =
    useState<Resource['illustrationType']>('oscilloscope');
  const [locText, setLocText] = useState('Electronics Lab B-102 · Cabinet 3');
  const [accessInstructions, setAccessInstructions] = useState(
    'Collect padded USB 3.0 logic probe kit from Technician Desk B-100 after check-in.'
  );
  const [description, setDescription] = useState(
    '16-channel 500 MS/s digital and analog logic analyzer for SPI, I2C, UART, CAN, and custom FPGA bus protocol decoding.'
  );
  const [condition, setCondition] = useState<ConditionLevel>('EXCELLENT');
  const [status, setStatus] = useState<ResourceStatus>('PUBLISHED');
  const [supervision, setSupervision] = useState<SupervisionLevel>('STAFF_CONFIRMATION');
  const [requireElecTraining, setRequireElecTraining] = useState(true);
  const [require3dTraining, setRequire3dTraining] = useState(false);
  const [accessoriesText, setAccessoriesText] = useState(
    '2x 8-Channel Wire Harnesses, 16x Micro-Gripper Test Clips, USB-C 3.0 Braided Data Cable, Carrying Case'
  );
  const [usageRules, setUsageRules] = useState(
    'Input voltage range -10V to +10V maximum. Connect ground reference clip before attaching signal probes.'
  );
  const [returnRules, setReturnRules] = useState(
    'Detach micro-gripper clips from harnesses and coil neatly inside case.'
  );
  const [cancellationPolicy, setCancellationPolicy] = useState('Cancel at least 2 hours prior.');
  const [editReason, setEditReason] = useState('Updated resource specifications and safety requirements.');

  // New Asset Unit Form
  const [newAssetTag, setNewAssetTag] = useState('');
  const [newSerial, setNewSerial] = useState('');

  // Status Change Dialog
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    resourceId: string;
    resourceName: string;
    nextStatus: ResourceStatus;
  }>({ open: false, resourceId: '', resourceName: '', nextStatus: 'PUBLISHED' });

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getResources();
      setResources(list);
      if (isEditMode && id) {
        const det = await api.getResource(id);
        const r = det.resource;
        setAssets(det.assets);
        setName(r.name);
        setModelNumber(r.modelNumber || '');
        setDepartment(r.department);
        setCategory(r.category);
        setIllustrationType(r.illustrationType);
        setLocText(r.location);
        setAccessInstructions(r.accessInstructions);
        setDescription(r.description);
        setCondition(r.condition);
        setStatus(r.status);
        setSupervision(r.supervision);
        setRequireElecTraining(
          r.requirements.some((req) => req.value === 'ELECTRONICS_INDUCTION')
        );
        setRequire3dTraining(
          r.requirements.some((req) => req.value === 'PRINTER_3D_SAFETY')
        );
        setAccessoriesText(r.accessories.join(', '));
        setUsageRules(r.usageRules);
        setReturnRules(r.returnRules);
        setCancellationPolicy(r.cancellationPolicy);
      }
    } finally {
      setLoading(false);
    }
  }, [isEditMode, id]);

  useEffect(() => {
    loadList();
  }, [loadList, user]);

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const requirements: Resource['requirements'] = [
      {
        key: 'req_mem',
        type: 'MEMBERSHIP',
        label: 'Verified Institutional Membership',
        value: user?.organizationId || 'org_nit',
      },
    ];
    if (requireElecTraining) {
      requirements.push({
        key: 'req_elec',
        type: 'TRAINING',
        label: 'Electronics Lab Safety & Bench Induction (EL-101)',
        value: 'ELECTRONICS_INDUCTION',
      });
    }
    if (require3dTraining) {
      requirements.push({
        key: 'req_3d',
        type: 'TRAINING',
        label: 'Additive Manufacturing & Thermal Safety Induction (AM-201)',
        value: 'PRINTER_3D_SAFETY',
      });
    }
    if (supervision !== 'NONE') {
      requirements.push({
        key: 'req_mgr',
        type: 'APPROVAL',
        label: 'Owner / Technician Approval Required',
        value: 'MANAGER_REVIEW',
      });
    }

    const accessories = accessoriesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (isEditMode && id) {
        await api.updateResource(
          id,
          {
            name,
            modelNumber,
            department,
            category,
            illustrationType,
            location: locText,
            accessInstructions,
            description,
            condition,
            status,
            supervision,
            requirements,
            accessories,
            usageRules,
            returnRules,
            cancellationPolicy,
          },
          editReason
        );
        showToast('success', 'Resource updated', 'Changes recorded in the Trust Ledger.');
        navigate(`/resources/${id}`);
      } else {
        const created = await api.createResource({
          name,
          modelNumber,
          department,
          category,
          illustrationType,
          location: locText,
          accessInstructions,
          description,
          condition,
          status,
          supervision,
          requirements,
          accessories,
          usageRules,
          returnRules,
          cancellationPolicy,
          availability: [
            {
              id: `av_${Date.now()}`,
              resourceId: '',
              dayOfWeek: 'Mon–Sat',
              start: '09:00',
              end: '19:00',
              recurrence: 'WEEKLY',
            },
          ],
          policyIds: ['pol_org_elig'],
        });
        showToast('success', 'Resource created & published', `Created ${created.name}.`);
        navigate(`/resources/${created.id}`);
      }
    } catch (err) {
      showToast('error', 'Failed to save resource', err instanceof Error ? err.message : '');
    }
  };

  const handleAddAssetUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newAssetTag.trim()) return;
    try {
      const ast = await api.createAssetForResource(
        id,
        newAssetTag.trim(),
        newSerial.trim() || `SN-${Date.now().toString().slice(-5)}`
      );
      setAssets((prev) => [...prev, ast]);
      setNewAssetTag('');
      setNewSerial('');
      showToast('success', 'Asset unit registered', `Generated QR token ${ast.qrToken}.`);
    } catch (err) {
      showToast('error', 'Failed to add asset', err instanceof Error ? err.message : '');
    }
  };

  if (isCreateMode || isEditMode) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-[var(--border-color)] pb-4 space-y-1">
          <Link
            to="/owner/resources"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to resource management</span>
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {isEditMode ? `Edit resource — ${name}` : 'Create & publish institutional resource'}
          </h1>
        </div>

        <form
          onSubmit={handleSaveResource}
          className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-5 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Resource name <span className="text-[var(--status-danger)]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Model / catalog identifier
              </label>
              <input
                type="text"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              >
                <option value="ELECTRONICS">ELECTRONICS</option>
                <option value="MEDIA_COMPUTING">MEDIA_COMPUTING</option>
                <option value="SPACE">SPACE</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Operational status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ResourceStatus)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              >
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PAUSED">PAUSED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Physical location <span className="text-[var(--status-danger)]">*</span>
              </label>
              <input
                type="text"
                required
                value={locText}
                onChange={(e) => setLocText(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Supervision rule
              </label>
              <select
                value={supervision}
                onChange={(e) => setSupervision(e.target.value as SupervisionLevel)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              >
                <option value="NONE">NONE (Self check-in)</option>
                <option value="STAFF_CONFIRMATION">STAFF_CONFIRMATION (Technician verifies return)</option>
                <option value="STAFF_PRESENT">STAFF_PRESENT (Supervised operation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-primary)] mb-1">
              Technical description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
            />
          </div>

          {/* Mandatory Training Checkboxes + Live Preview */}
          <div className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-2">
            <div className="font-semibold text-[var(--text-primary)]">
              Mandatory qualification & safety requirements (deterministic)
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireElecTraining}
                  onChange={(e) => setRequireElecTraining(e.target.checked)}
                />
                <span>Require Electronics Lab Induction (EL-101)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={require3dTraining}
                  onChange={(e) => setRequire3dTraining(e.target.checked)}
                />
                <span>Require 3D Printer Thermal Safety Induction (AM-201)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-primary)] mb-1">
              Included accessories checklist (comma-separated)
            </label>
            <input
              type="text"
              value={accessoriesText}
              onChange={(e) => setAccessoriesText(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Usage & safety rules
              </label>
              <textarea
                rows={2}
                value={usageRules}
                onChange={(e) => setUsageRules(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Return inspection rules
              </label>
              <textarea
                rows={2}
                value={returnRules}
                onChange={(e) => setReturnRules(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to="/owner/resources"
              className="px-4 py-2 rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
            >
              {isEditMode ? 'Save changes & log to ledger' : 'Create & publish resource'}
            </button>
          </div>
        </form>

        {/* Assets & QR Unit Registration when Editing */}
        {isEditMode && id && (
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Registered physical units & QR tokens ({assets.length})
              </h2>
              <Link
                to={`/labels/${id}`}
                className="text-[var(--brand-primary)] font-medium hover:underline"
              >
                Open printable QR label sheet →
              </Link>
            </div>

            <div className="space-y-2">
              {assets.map((ast) => (
                <div
                  key={ast.id}
                  className="p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] flex items-center justify-between"
                >
                  <div>
                    <strong className="font-mono-tech">{ast.assetTag}</strong> · SN: {ast.serialNumber}
                  </div>
                  <div className="font-mono-tech text-[var(--text-secondary)]">
                    QR Token: {ast.qrToken}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddAssetUnit} className="flex flex-wrap gap-2 pt-2">
              <input
                type="text"
                value={newAssetTag}
                onChange={(e) => setNewAssetTag(e.target.value)}
                placeholder="New Asset Tag (e.g., NIT-EL-OSC-002)"
                className="flex-1 px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
              <input
                type="text"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                placeholder="Serial Number"
                className="w-44 px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
              <button
                type="submit"
                className="px-4 py-2 font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] cursor-pointer"
              >
                Add unit & generate QR
              </button>
            </form>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Owner resource management
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Create, configure, pause, or mark resources for maintenance. All status changes require a recorded reason and append to the Trust Ledger.
          </p>
        </div>

        <Link
          to="/owner/resources/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] self-start"
        >
          <Plus className="w-4 h-4" />
          <span>New resource listing</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Loading resources...</div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/60 text-xs font-semibold text-[var(--text-secondary)]">
                  <th className="py-3 px-4">Resource & Location</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status & Condition</th>
                  <th className="py-3 px-4">Supervision</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-xs">
                {resources.map((res) => (
                  <tr key={res.id} className="hover:bg-[var(--bg-secondary)]/30">
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/resources/${res.id}`}
                        className="font-semibold text-sm text-[var(--text-primary)] hover:underline"
                      >
                        {res.name}
                      </Link>
                      <div className="text-[var(--text-secondary)] mt-0.5">{res.location}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tech text-[var(--text-secondary)]">
                      {res.category}
                    </td>
                    <td className="py-3.5 px-4 space-y-1">
                      <div>
                        <StatusIndicator kind="resource" value={res.status} />
                      </div>
                      <div>
                        <StatusIndicator kind="condition" value={res.condition} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                      {res.supervision.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/labels/${res.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Labels</span>
                      </Link>
                      <Link
                        to={`/owner/resources/${res.id}/edit`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                      >
                        <span>Edit</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setStatusModal({
                            open: true,
                            resourceId: res.id,
                            resourceName: res.name,
                            nextStatus: res.status === 'PUBLISHED' ? 'MAINTENANCE' : 'PUBLISHED',
                          })
                        }
                        className="px-2.5 py-1.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        {res.status === 'PUBLISHED' ? 'Set Maintenance' : 'Publish'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={statusModal.open}
        title={`Change status of ${statusModal.resourceName} to ${statusModal.nextStatus}?`}
        description="Status changes take effect immediately and are recorded in the tamper-evident Trust Ledger."
        confirmLabel={`Confirm ${statusModal.nextStatus}`}
        requireReason={true}
        reasonLabel="Operational reason"
        reasonPlaceholder="e.g., Scheduled probe recalibration and firmware update."
        onConfirm={async (reason) => {
          await api.publishResource(statusModal.resourceId, statusModal.nextStatus, reason);
          showToast('success', `Resource marked ${statusModal.nextStatus}`);
          await loadList();
        }}
        onClose={() => setStatusModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
