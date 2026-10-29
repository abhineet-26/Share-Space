# Product Roadmap, Positioning, and Pilot Plan

This document describes where SHARESPACE goes after the 48-hour build. Nothing here is a claim of implemented functionality; see `MEMORY.md` for current status.

## 1. Positioning

SHARESPACE is accountability infrastructure for shared institutional assets. A booking calendar answers "when is it free?". SHARESPACE also answers who may use it, who approves, how it was handed over and returned, whether access is fair, and what the verifiable record says.

**First market:** campuses, makerspaces, and community labs where equipment is expensive, access is restricted, and trust between owner and user matters.

**Differentiators**
- Eligibility and approval are enforced, explainable, and separate.
- Fair allocation is configurable policy with visible reasons, not first-click-wins.
- Handover and return are evidence-backed (condition reports, photos, QR identity).
- A tamper-evident ledger both owner and user can rely on.
- Tenant isolation and policy versioning make it deployable for multiple organisations.

## 2. Release stages

### v0.1 — Hackathon build (48 hours)
- Full lifecycle: list, discover, eligibility, request, decision, check-in, return, incident, history.
- Tier 1 foundations: RLS tenancy, versioned policies, hash-chained ledger, CI, idempotent booking.
- Tier 2 if time allows: QR, evidence uploads, OIDC, outbox notifications.

### v0.2 — Pilot-ready (first real institution, about 4 to 8 weeks)
- OIDC with the institution's identity provider; role assignment workflow.
- Evidence uploads, QR labels, outbox notifications by email.
- Admin console: policies, roles, resources, exports.
- Data retention settings, data export and deletion workflows.
- Backups, restore drill, staging environment, uptime monitoring.
- Accessibility audit against WCAG 2.1 AA.
- Pilot with one department and a small set of resources; weekly feedback.

### v1.0 — Multi-organisation product
- Organisation onboarding, branding, and per-org settings.
- Calendar sync (ICS, Google, Microsoft).
- Maintenance and calibration windows per asset; blackout dates.
- Training and certification management with expiry and renewal reminders.
- Utilisation and demand reports with export.
- Public API and webhooks.
- Ledger anchoring to an external write-once store.

### Later
- Credits or payments for externally shared resources, with a reviewed legal and financial design.
- Cross-institution sharing agreements as explicit, auditable objects.
- Deposits and insurance workflows with partners.
- Mobile app or PWA with offline-tolerant check-in.
- Optional hardware integrations (smart locks, equipment telemetry).

## 3. AI roadmap (always assistive)

- Natural-language discovery, incident drafting, and utilisation summaries.
- Anomaly flags for suspicious usage patterns, shown to reviewers as signals with evidence, never as automatic penalties.
- Document review assistance for training certificates, with a human verifying every result.
- Principles: schema-validated output, reconciled against the database, logged when used, never the final decision-maker for access, safety, liability, or penalties.

## 4. Pilot plan

1. Pick one department with 5 to 15 high-value assets and a willing lab manager.
2. Agree eligibility rules, usage caps, return rules, and escalation paths in writing; encode them as policies.
3. Import real asset lists (authorised data only) and print QR labels.
4. Run for a defined period with weekly review of declined/waitlisted requests, incident outcomes, and manager workload.
5. Decide go/no-go with the owner using the metrics below.

## 5. Success metrics (define baselines in the pilot, not assumed here)

- Share of eligible requests decided within the owner's target time.
- Utilisation of previously underused assets versus the pre-pilot baseline.
- Share of bookings with complete before-and-after condition records.
- Number of access disputes and time to resolve them.
- Distribution of access across users and groups (to check the fairness policy is not producing persistent exclusion).
- Manager time per booking.
- User-reported clarity of decisions.

## 6. Risks and open questions

| Risk | Mitigation |
|---|---|
| Liability and insurance for loaned equipment | Keep liability decisions human-only; involve institution legal and risk teams before pilot |
| Data protection obligations for student data | Minimise data, retention policy, export/deletion workflows, review with institution |
| Adoption by busy lab staff | Fast handover flow (QR, mobile), clear queue, low admin overhead |
| Policy complexity grows unmanageable | Small set of rule types, preview before activation, versioning |
| Ledger overclaiming | Say tamper-evident; add external anchoring before stronger claims |
| Single-provider dependence (identity, storage, AI) | Interfaces and adapters; AI optional |
| Trademark/name conflict | Verify the name before public branding |

## 7. Business model options to evaluate

- Per-organisation subscription tiered by assets or active users.
- Free tier for small makerspaces and community groups.
- Paid services: onboarding, integrations, analytics.
- To be tested in the pilot; no pricing or revenue claims are made in this pack.
