# SHARESPACE — Project Documentation Pack

**Working name:** SHARESPACE  
**Tagline:** Access more. Waste less. Build together.  
**Product type:** Trusted institutional resource-sharing platform  
**Primary MVP setting:** College campus: equipment, laboratories, and shared spaces  
**Document status:** Planning baseline (revision 2, 2026-10-28) covering the 48-hour build and the professional-product foundations; update to reflect the implementation actually built.

## Included documents

- `PRD.md` — Product requirements, personas, scope, stories, acceptance criteria, and success metrics.
- `ARCHITECTURE.md` — System design, components, data model, API contracts, state machines, security, and deployment.
- `DESIGN.md` — UX principles, information architecture, screen specifications, interaction states, and visual system.
- `RULES.md` — Product policies, permissions, eligibility, fairness, booking, audit, incident, privacy, and AI guardrails.
- `PHASES.md` — 48-hour delivery plan, milestones, task ownership, testing, demo, and submission checklist.
- `MEMORY.md` — Durable project context and decisions for future AI coding sessions.
- `ROADMAP.md` — Product positioning, post-hackathon roadmap, pilot plan, risks, and success metrics.

## Product thesis

SHARESPACE is not merely a booking calendar. It manages a resource-sharing transaction from listing and eligibility through approval, handover, return, and incident resolution, with understandable decisions and an auditable history.

## MVP definition

A judge must be able to complete at least one real, persisted end-to-end journey:

1. An owner lists a resource and defines requirements.
2. A user discovers the resource and checks eligibility.
3. The user submits a request.
4. The system evaluates deterministic requirements.
5. An authorised owner/manager approves, rejects, or waitlists the request.
6. The user checks in and records initial condition.
7. The user checks out and records final condition.
8. Any delay or damage can be reported and reviewed.
9. The transaction history shows important actions and decision reasons.

## Professional-product foundations (added in revision 2)

Built inside the 48 hours (Tier 1): multi-tenancy with PostgreSQL row-level security, policies stored as versioned data, a hash-chained tamper-evident ledger, CI with core tests, idempotent booking, structured logging. Built if the MVP gate is met (Tier 2): asset QR identity, evidence attachments, OIDC sign-in, outbox-based notifications. Roadmap only (Tier 3): payments/credits, calendar sync, cross-institution agreements, public API/webhooks, ledger anchoring. Details are in `PRD.md` section 13, `ARCHITECTURE.md`, `RULES.md`, and `PHASES.md`.

## Recommended baseline stack

- Frontend: Next.js + TypeScript
- UI: Tailwind CSS + accessible component primitives
- Backend: Python + FastAPI
- Database: PostgreSQL
- Authentication: OIDC (authorization code + PKCE) via a managed provider; demo login behind a non-production flag
- Background tasks: worker with transactional outbox (minimal version in MVP)
- Storage: S3-compatible object storage for evidence (Tier 2)
- Delivery: GitHub Actions CI, structured logging, error tracking
- AI: optional LLM API for natural-language discovery or incident-report drafting
- Deployment: any reliable provider compatible with the selected stack

The stack is a recommendation, not a requirement. Keep one coherent stack and prioritise the end-to-end workflow over technology breadth.

## Status and honesty

This pack is a specification, not proof that any feature has been implemented. Mark features as implemented only after they work in the deployed product and have been tested. Use fictional or authorised demonstration data. Disclose AI tools, libraries, templates, and pre-existing assets in the submission.
