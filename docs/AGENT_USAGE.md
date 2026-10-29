# SHARESPACE Agency Agents Skill Usage

**Generated**: 2026-10-29  
**Phase**: 0 — Repository, Documentation, Frontend, and Skill Audit

---

## Discovered Skills Inventory

The repository contains **221 skills** in `.agents/skills/`. Below are the skills relevant to SHARESPACE implementation, mapped to capability areas and phases.

| Skill/Agent | Actual Path | Capability | How Invoked | Phase(s) | Used? | Verified Contribution/Evidence |
|-------------|-------------|------------|-------------|----------|-------|--------------------------------|
| **engineering-backend-architect** | `.agents/skills/engineering-backend-architect/` | Scalable system design, database architecture, API development, cloud infrastructure. Defines data schemas, migration strategies, API contracts, security, observability. | Load skill, apply architecture patterns to FastAPI/PostgreSQL design | 01, 02, 06, 09 | ✅ Phase 0 | Informed BACKEND_PLAN.md schema, RLS design, migration sequence, API contract structure |
| **engineering-api-platform-engineer** | `.agents/skills/engineering-api-platform-engineer/` | Contract-first OpenAPI design, versioning, deprecation policy, SDK generation, gateway concerns (auth, rate limiting, quotas), developer experience. | Load skill, apply to CONTRACT.md and FastAPI route design | 01, 12 | ✅ Phase 0 | Informed CONTRACT.md OpenAPI structure, error shape consistency, pagination, idempotency headers |
| **engineering-database-reliability-engineer** | `.agents/skills/engineering-database-reliability-engineer/` | HA/replication, automated failover, backup/PITR, zero-downtime migrations (expand-contract), connection pooling, disaster recovery drills. | Load skill, apply to PostgreSQL setup, RLS, migration safety | 01, 02, 09 | ✅ Phase 0 | Informed RLS design, migration sequence (expand-contract), app/migration role separation, backup strategy |
| **security-architect** | `.agents/skills/security-architect/` | Threat modeling, secure-by-design, trust boundaries, defense-in-depth, RBAC/ABAC, secrets management, encryption, supply chain security. | Load skill, apply to auth/permissions, RLS, ledger, audit design | 03, 09, 13 | ✅ Phase 0 | Informed permission matrix, RLS threat model, ledger append-only design, demo login security |
| **engineering-frontend-developer** | `.agents/skills/engineering-frontend-developer/` | Modern React/Vue/Angular, UI implementation, performance optimization, accessibility (WCAG 2.1 AA), component libraries, state management. | Load skill, apply to frontend integration, live mode switch, E2E tests | 12, 13 | ✅ Phase 0 | Informed frontend integration plan: preserve existing React 19/Vite/Tailwind, live/mock toggle, accessibility checklist |
| **engineering-senior-developer** | `.agents/skills/engineering-senior-developer/` | Premium implementation, Laravel/Livewire/FluxUI, advanced CSS, Three.js integration. (Note: stack differs but craftsmanship principles apply) | Load skill, apply code quality standards, premium UX patterns | 12, 13 | ⚠️ Partial | Principles applied: small verified increments, test-driven, no TODO-driven completion |
| **engineering-devops-automator** | `.agents/skills/engineering-devops-automator/` | CI/CD pipelines, GitHub Actions, infrastructure as code, deployment automation, monitoring. | Load skill, design CI workflow for backend + frontend | 01, 14 | ⏳ Planned | Will inform GitHub Actions CI: lint, types, pytest+PostgreSQL, migration check, frontend build |
| **engineering-code-reviewer** | `.agents/skills/engineering-code-reviewer/` | Security scan, quality gates, auto-fix, pre-commit review. | Load skill, integrate into CI/pre-commit | 01, 13 | ⏳ Planned | Will inform pre-commit hooks: Ruff, secret scan, type check |
| **engineering-software-architect** | `.agents/skills/engineering-software-architect/` | System architecture, modular monolith vs microservices, domain-driven design, event-driven systems. | Load skill, validate modular monolith choice | 01 | ✅ Phase 0 | Confirmed modular monolith (FastAPI single deployable) per ARCHITECTURE.md |
| **engineering-data-engineer** | `.agents/skills/engineering-data-engineer/` | Data pipelines, ETL, schema evolution, data quality, privacy. | Load skill, apply to seed data, analytics, ledger | 02, 11 | ⏳ Planned | Will inform deterministic seed script, analytics computation, ledger canonicalization |
| **engineering-technical-writer** | `.agents/skills/engineering-technical-writer/` | Documentation, API docs, runbooks, architecture decision records. | Load skill, maintain docs/MEMORY.md, TESTING.md, README | 00, 14 | ✅ Phase 0 | Applied to all Phase 0 deliverables (BACKEND_PLAN, CONTRACT, AGENT_USAGE, IMPLEMENTATION_STATUS) |
| **agent-reach** | `.agents/skills/agent-reach/` | Research, search, investigation workflows. | Load skill, use for external API research (OIDC providers, S3-compatible storage) | 10, 14 | ⏳ Planned | Will use for Tier 2 provider selection |
| **autonomous-ai-agents/claude-code** | `.agents/skills/claude-code/` | Delegate coding to Claude Code CLI for features, PRs. | If available, delegate bounded backend tasks | 01-14 | ⏳ Available | Can delegate Phase 01-09 implementation tasks if environment supports |
| **autonomous-ai-agents/codex** | `.agents/skills/codex/` | Delegate coding to OpenAI Codex CLI. | If available, delegate bounded tasks | 01-14 | ⏳ Available | Alternative delegation target |
| **autonomous-ai-agents/computer-use** | `.agents/skills/computer-use/` | Drive desktop in background for testing, verification. | Use for E2E verification, browser testing | 12, 13 | ⏳ Available | Can drive Playwright/Godot for visual verification |
| **mlops/huggingface-hub** | `.agents/skills/huggingface-hub/` | HF CLI: search/download/upload models, datasets. | If AI model hosting needed for Tier 2 | 10 | ⏳ Available | Could host deterministic fallback models |
| **mlops/evaluation/evaluating-llms-harness** | `.agents/skills/evaluating-llms-harness/` | lm-eval-harness for LLM benchmarking. | If evaluating AI assistive features | 10 | ⏳ Available | Could benchmark Gemini vs deterministic fallback |
| **mlops/inference/serving-llms-vllm** | `.agents/skills/serving-llms-vllm/` | vLLM high-throughput LLM serving. | If self-hosting AI for demo | 10 | ⏳ Available | Alternative to Gemini API for AI features |
| **nvidia-skill-finder** | `.agents/skills/nvidia-skill-finder/` | Locate NVIDIA skills for NVIDIA-related requests. | Not directly applicable | — | ❌ | SHARESPACE is not NVIDIA-specific |

---

## Skill-to-Phase Mapping

### Phase 01 — Backend Foundation and CI
**Primary Skills**:
- `engineering-backend-architect` — FastAPI app factory, lifespan, settings, routing
- `engineering-api-platform-engineer` — OpenAPI contract, error handling, versioning
- `engineering-database-reliability-engineer` — PostgreSQL connection, pool, migration role
- `engineering-devops-automator` — GitHub Actions CI workflow
- `engineering-code-reviewer` — Pre-commit hooks (Ruff, secret scan)

### Phase 02 — Schema, RLS, Migrations, Seed
**Primary Skills**:
- `engineering-backend-architect` — Domain models, SQLAlchemy 2, Alembic
- `engineering-database-reliability-engineer` — RLS policies, expand-contract migrations, app role (no BYPASSRLS)
- `security-architect` — RLS threat model, tenant isolation verification
- `engineering-data-engineer` — Deterministic seed script, data integrity

### Phase 03 — Authentication, Sessions, Permissions
**Primary Skills**:
- `security-architect` — OIDC design, demo login flag, RBAC, session/JWT, CSRF
- `engineering-backend-architect` — Auth dependency, permission service, middleware
- `engineering-api-platform-engineer` — Auth error codes, 401/403/404 semantics

### Phase 04 — Resources, Availability, Assets, QR
**Primary Skills**:
- `engineering-backend-architect` — Resource CRUD, availability windows, asset registration
- `engineering-api-platform-engineer` — QR token generation (unguessable, rotatable), scan endpoint
- `security-architect` — QR token security (no data, hashed at rest, scan ≠ access)

### Phase 05 — Policy Engine, Eligibility
**Primary Skills**:
- `engineering-backend-architect` — Policy versioning, declarative schema, preview endpoint
- `engineering-data-engineer` — Eligibility evaluation engine, deterministic rules
- `security-architect` — Policy activation audit, most-restrictive-rule-wins

### Phase 06 — Booking Lifecycle, Concurrency
**Primary Skills**:
- `engineering-backend-architect` — State machine service, idempotency, exclusion constraint
- `engineering-database-reliability-engineer` — PostgreSQL exclusion constraint (btree_gist + tstzrange)
- `security-architect` — Concurrency safety, transaction boundaries, race condition tests

### Phase 07 — Fair Allocation, Waitlist
**Primary Skills**:
- `engineering-backend-architect` — Allocation service, usage caps, waitlist promotion
- `engineering-data-engineer` — Deterministic ordering, rolling window calculations
- `security-architect` — Manager override audit, no hidden scores

### Phase 08 — Handover, Return, Incidents
**Primary Skills**:
- `engineering-backend-architect` — Condition reports, staff confirmation, incident workflow
- `security-architect` — Human review enforcement, no auto-penalties, evidence privacy

### Phase 09 — Trust Ledger
**Primary Skills**:
- `engineering-backend-architect` — Hash chain, canonical serialization, pg_advisory_xact_lock
- `engineering-database-reliability-engineer` — Insert-only trigger, app role privileges
- `security-architect` — Tamper detection, correction events, verification endpoint

### Phase 10 — Notifications, Tier 2 Infrastructure
**Primary Skills**:
- `engineering-backend-architect` — Outbox pattern, worker (FOR UPDATE SKIP LOCKED)
- `engineering-devops-automator` — Worker deployment, monitoring
- `agent-reach` — Research OIDC providers, S3-compatible storage options

### Phase 11 — Admin, Analytics, Profile Export
**Primary Skills**:
- `engineering-backend-architect` — Admin endpoints, analytics aggregations
- `engineering-data-engineer` — Fairness calculations, utilisation formulas
- `security-architect` — Data export privacy, admin scope enforcement

### Phase 12 — Live Frontend Integration
**Primary Skills**:
- `engineering-frontend-developer` — Live mode integration, mock/live parity, E2E tests
- `engineering-backend-architect` — Contract compliance, error shape matching
- `autonomous-ai-agents/computer-use` — Visual verification of demo journey

### Phase 13 — Security, Reliability, Accessibility Hardening
**Primary Skills**:
- `security-architect` — Full permission review, secret scan, dependency vuln check
- `engineering-frontend-developer` — Keyboard journey, focus, contrast, responsive
- `engineering-code-reviewer` — Quality gates, auto-fix
- `engineering-database-reliability-engineer` — Query review, N+1, connection pool

### Phase 14 — Deployment, Submission
**Primary Skills**:
- `engineering-devops-automator` — Dockerfiles, docker-compose, deployment docs
- `engineering-technical-writer` — README, TESTING.md, submission document
- `agent-reach` — Verify submission links, judge credentials

---

## Skills Not Used (Intentional)

| Skill | Reason |
|-------|--------|
| `engineering-ai-engineer`, `engineering-llm-post-training-engineer` | AI is optional Tier 2; deterministic fallbacks already implemented |
| `engineering-rust-refactoring-specialist` | Stack is Python/TypeScript |
| `engineering-mobile-app-builder` | Responsive web only for MVP |
| `engineering-embedded-firmware-engineer` | No hardware integration |
| `engineering-blockchain-security-auditor` | Ledger is hash-chained, not blockchain |
| Marketing/finance/HR/legal skills | Not applicable to technical implementation |
| `design-*` skills | Frontend design system already established; no redesign |
| `specialized-*` skills | Not relevant to this domain |

---

## Agent Usage Protocol

Per MASTER_PROMPT Section 5:

1. **Discovery** — Completed in Phase 0 (this document)
2. **Selection** — Skills mapped to phases above based on actual capability match
3. **Invocation** — For substantial work, delegate bounded tasks with:
   - Explicit context (files, paths, contracts)
   - Acceptance criteria
   - Constraints (tenant isolation, deterministic rules, ledger invariants, approved design)
   - Expected evidence (test results, diffs, verification)
4. **Reconciliation** — Hermes reviews all specialist output, runs tests, reviews diffs
5. **Documentation** — Update this file at each phase boundary with actual usage

---

## Verification Standards

A skill is marked **Used** only when:
- The skill's instructions were actively followed during the phase
- The skill contributed verifiable output (code, config, test, doc)
- Hermes reviewed and integrated the output

A skill is **Not Used** if:
- Only its documentation was read (not invoked)
- It was considered but not applicable
- Its capabilities were applied manually by Hermes without delegation

---

## Next Update

This document will be updated at each phase boundary (per MASTER_PROMPT Section 6) with:
- Which skills were actually invoked
- What specific contribution they made
- Test/verification evidence
- Any skill issues discovered (to be patched via `skill_manage`)

---

*This document satisfies MASTER_PROMPT Section 5 "Required Phase 0 output" for docs/AGENT_USAGE.md.*