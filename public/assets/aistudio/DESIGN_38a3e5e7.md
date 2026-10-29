# UX / UI Design Specification

## 1. Design direction

SHARESPACE should feel like a dependable campus operations tool: clear, modern, calm, and practical. It should not look like a generic e-commerce storefront or an overly playful social network.

**UX promise:** users should understand what a resource is, whether they can request it, who decides, and what happens next.

## 2. UX principles

1. **Clarity before decoration:** availability, eligibility, supervision, and return rules are prominent.
2. **Explain decisions:** never show only “Denied” or “Waitlisted”; include a reason and next step.
3. **Progress visibility:** display the current lifecycle stage and remaining actions.
4. **Owner control:** only authorised people can publish resources, approve requests, or confirm restricted handovers.
5. **Safety by design:** restricted resources show requirements before the user submits.
6. **Accessible status:** combine labels/icons/text, not colour alone.
7. **Recoverable errors:** explain how to correct missing information or resolve conflicts.
8. **Responsive layout:** usable on phone and desktop, especially for check-in/return.
9. **Privacy by default:** show only the user information necessary for the current task.
10. **No fake functionality:** buttons must work or be clearly disabled with an explanation.

## 3. Information architecture

### User
- Dashboard
- Discover resources
- Resource detail
- Request resource
- My bookings
- Booking detail / timeline
- Check-in
- Return / condition report
- Report an incident
- Notifications
- Profile / verification / training

### Owner / manager
- Overview
- My resources
- Create/edit resource
- Availability
- Request review queue
- Request decision detail
- Handover / return confirmation
- Incident queue
- Audit history
- Utilisation analytics

### Admin
- Users and roles
- Institution/policy settings
- Verification status
- Audit oversight

The MVP can combine several of these into tabbed or panel-based routes.

## 4. Primary navigation

Desktop:
- Left sidebar: Overview, Discover, My bookings, Resources (role-dependent), Requests, Incidents, Audit.
- Top bar: current institution, notifications, profile.
- Main content: page title, concise context, primary action.

Mobile:
- Compact top bar.
- Bottom navigation or collapsible menu for primary destinations.
- Full-width forms with sticky primary action only when it does not obscure content.

## 5. Key screens and requirements

### Screen A — Dashboard
Show:
- Next booking and next required action.
- Request status summary.
- Resources recently viewed or recommended.
- Manager queue counts when role permits.
- Alerts for overdue returns or incidents.

Avoid meaningless vanity metrics. Every card should lead to a useful action or detail.

### Screen B — Resource discovery
Elements:
- Search field with placeholder such as “Find a resource for your project”.
- Filters: category, date/time, location, availability, training/supervision.
- Resource cards with name, category, location, availability indicator, and key requirement.
- Clear empty state with suggestions to change filters.
- Loading and error states.

Card CTA should say “View details” rather than implying the resource can be booked without review.

### Screen C — Resource detail
Order of information:
1. Name, category, status, owner.
2. Availability calendar/slots.
3. Location and access conditions.
4. Eligibility and training.
5. Supervision requirement.
6. Condition and included accessories.
7. Return rules and cancellation policy.
8. Request action.

If not eligible, show a clear reason and remediation action. Do not hide the request requirements below long descriptive copy.

### Screen D — Booking request
Fields:
- Start and end time.
- Purpose / project description.
- Required confirmation checkboxes (only when meaningful).
- Optional supporting detail.

Display:
- Requested duration.
- Availability validation.
- Eligibility preview.
- Applicable policy summary.

Submit button text: “Submit request”. Confirmation must distinguish request submission from booking approval.

### Screen E — Eligibility result
Use a checklist:
- Identity/account status.
- Institution membership.
- Training.
- Availability/conflict.
- Usage limits.
- Manual review requirement.

Each check shows status, reason, and next action. Distinguish hard failure from review-required conditions.

### Screen F — Manager request review
Show:
- Resource and requested time.
- Requester identity fields permitted by policy.
- Purpose.
- Eligibility results.
- Scheduling conflict and competing request summary.
- Relevant usage-limit information.
- Approve / Reject / Waitlist actions.
- Required decision reason.

Use a confirmation step for irreversible or consequential decisions.

### Screen G — Booking timeline / Trust Ledger
Show chronological events:
- Request created.
- Eligibility checked.
- Decision and reason.
- Check-in.
- Initial condition report.
- Return initiated.
- Final condition report.
- Staff confirmation.
- Incident and resolution, if any.

Each event displays timestamp, actor/role, action, and concise details. Corrections appear as later events.

### Screen H — Check-in / initial condition
Fields:
- Condition status: operational / issue observed / unable to assess.
- Notes.
- Included accessories checklist.
- Optional evidence attachment if supported.
- Confirmation that the record is accurate.

For supervised resources, clearly show the required staff confirmation.

### Screen I — Return / final condition
Fields:
- Final condition.
- Accessories returned.
- Notes.
- Actual return time.
- Submit return report.
- Staff confirmation where required.

If a potential issue is reported, show that it will be reviewed and avoid assigning blame.

### Screen J — Incident
Fields:
- Incident category: damage / delay / missing item / safety concern / other.
- Description.
- When discovered.
- Evidence reference/upload if supported.
- Submit report.

After submission, show incident ID, status, and what happens next.

### Screen K — Owner resource management
List resources with status, availability, utilisation, pending requests, and action menu. Resource creation/editing uses grouped fields with inline validation.

### Screen L — Analytics
Show simple, defined metrics:
- Active resources.
- Booked hours / available hours for a defined period.
- Demand by category.
- Waitlisted requests.
- Incident counts/status.

State the date range and formula. Do not infer that low utilisation means a resource should be removed; present insights as suggestions.

### Screen M — Policy editor (admin/owner)
- List of policies by scope (organisation, category, resource) with status and active version.
- Edit form for a new version with schema-validated fields (for example usage cap window and hours).
- Preview panel: run the draft policy against a sample request and show the outcome and reasons before activation.
- Show who changed what and when; activation requires a reason.

### Screen N — Asset QR and scan
- Printable label sheet per resource (QR, asset tag, name).
- Scan landing page shows only actions the signed-in scanner may take now (start check-in, start return, view history); otherwise an explanation.
- Must work on a phone, in low light, with large touch targets.

### Screen O — Evidence capture
- Photo capture/upload inside check-in, return, and incident forms with type/size guidance and upload progress.
- Show a thumbnail and the recorded file fingerprint status ("recorded in ledger").

### Screen P — Ledger integrity
- Ledger view shows a "chain verified" status with the time of the last verification and the head sequence number.
- Admin can run verification; a failure shows the first affected sequence number and next steps.
- Wording: "tamper-evident history", never "immutable".

## 6. Visual system

A practical default:
- Neutral light background and white/near-white surfaces.
- Dark, high-contrast text.
- One primary accent (blue/indigo or teal) for primary actions.
- Semantic status labels:
  - Green: approved/success
  - Amber: pending/review/overdue warning
  - Red: blocked/error/incident attention
  - Grey: draft/inactive/neutral
- Use icons sparingly and pair with text labels.
- Border radius and shadows should be consistent.
- Avoid dense dashboards with too many charts.

Suggested typography:
- One readable sans-serif family.
- Clear hierarchy: page title, section heading, body, metadata.
- Minimum comfortable body size around 14–16 px on desktop/mobile.

## 7. Component inventory

Additional components for the product foundations: policy version form, policy outcome preview, QR label sheet, scanner landing card, evidence uploader with progress, ledger integrity badge.


- `AppShell`
- `RoleAwareSidebar`
- `TopBar`
- `ResourceCard`
- `ResourceStatusBadge`
- `EligibilityChecklist`
- `AvailabilitySlotPicker`
- `BookingStatusBadge`
- `BookingTimeline`
- `DecisionReasonPanel`
- `ConditionReportForm`
- `IncidentStatusBadge`
- `AuditEventList`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `ConfirmActionDialog`
- `Toast/InlineAlert`
- `AccessibleDataTable`

## 8. Interaction and content rules

- Use sentence-case labels.
- Explain why a primary action is unavailable.
- Avoid ambiguous status names like “Done” where “Returned — awaiting staff confirmation” is more accurate.
- Every form has validation, loading, success, and failure states.
- Prevent double submission with UI feedback and backend idempotency where practical.
- Show timestamps in the user's local timezone while storing UTC.
- Preserve entered form values after recoverable errors.
- Ask for confirmation before cancellation or manager decisions that affect others.
- Do not display another user's private booking details to unauthorised viewers.

## 9. Accessibility checklist

- All controls reachable by keyboard.
- Visible focus indicators.
- Correct labels and accessible names.
- Error text associated with the relevant input.
- Sufficient text/background contrast.
- Status communicated in text, not colour alone.
- Dialog focus management and escape behaviour.
- Tables have headings and mobile alternatives.
- Touch targets are sufficiently large.
- Test at narrow viewport widths.

## 10. Demo experience

The judge should land on a clear dashboard with a demo account or documented login. Seed one active resource, one pending request, one approved booking ready for handover, and one example incident. Keep the main happy path available so the judge can run it from start to finish without database manipulation.
