# Customer AI modernisation

## Review scope and findings

This is an architecture and customer-journey review, not an exhaustive audit of every backend class. The platform has three Next.js portals (customer, bank operations, solicitor), shared UI/types/config, customer/admin BFFs, and domain services for identity, customer, accounts, origination, underwriting, documents, funding, legal cases, notifications, reporting and AI assistance.

The existing AI roadmap already describes a governed agent platform. Extend that foundation rather than introduce another chatbot or a competing application workflow.

Implementation evidence:

- `apps/cust-portal/src/lib/banking-data.ts` provides sample banking data. Live customer-scoped data is the prerequisite for production financial insights.
- `apps/cust-portal/src/services/api/account-service.ts` now reads real deposit accounts from the customer BFF and falls back to the sample set, always reporting which one it used.
- `apps/cust-portal/src/app/portal/payments/page.tsx` simulates payments locally. No payment-request backend is wired into this screen.
- `apps/cust-portal/src/services/api/ai-credit-journey-service.ts` supports need discovery, intent review and a confirmed handoff to origination.
- `apps/cust-portal/src/services/api/document-extraction-service.ts` supports bank statements and payslips, with reviewable drafts. Tax extraction is absent from the contract.
- `apps/cust-portal/src/app/portal/applications/new/page.tsx` already supports personal/business steps, save/resume, financial and employment prefill, review and submission.
- Backend customer BFF controllers expose credit journeys, extraction, intelligence, applications, tasks, offers, signing and booking, and now deposit accounts.
- AI service controllers expose approvals, knowledge, application AI, prompt registry, customer intelligence and document/credit journeys.
- Bank operations has AI approval and knowledge-management screens. The solicitor portal has documents, queries, checklists, undertakings and drawdown panels.

Backend gaps confirmed by reading `cms-backend` directly, which constrain several slices:

- `bff-customer` had no accounts, transactions, payments, beneficiaries or savings-goal endpoint. Accounts are now served (see below); the others still do not exist anywhere in the backend.
- `credit.account_transaction` exists as a table but holds **zero rows** and no seed file populates it. `AccountTransaction`'s JPA columns also do not match `database/current_schema.sql` (for example `origin_system` vs `source_system`, `narrative` vs `remittance_info`, `is_reversed` vs `is_reversal`, plus `batch_id`, `processed_at` and `error_code` that the table does not have). Building a transaction feed therefore needs a schema/entity reconciliation and seeded or ingested data first, not just an endpoint.
- Customer intelligence emits only four loan-lifecycle signal types — `SLA_AT_RISK`, `APPLICATION_STALLED`, `DOCUMENT_MISSING`, `KYC_AML_PENDING`. There are no spending, recurring-bill, category or goal signals, so slice 2 cannot yet be sourced from it.
- `ai-assistant-service` exposes customer recommendations and accept/dismiss endpoints that `bff-customer` does not proxy.

## Implemented UI

- Previous-transfer shortcuts: outgoing transfers prefill the existing form; incoming transfers prepare an editable request message to copy. No money is moved or message sent.
- Per-profile browser preferences for insights, repeat shortcuts and document assistance. Disabling insights also suppresses the overview signal fetch. These are UI preferences, not backend consent controls.
- Clearer application progress and a document-assisted start using the existing extraction API. Values are reviewed before application to the draft; manual entry remains available.
- File type/size validation and explicit handling of extraction responses that did not produce a draft.

An earlier "editorial welcome" and plum "intelligence brief" (marketing headline, cash-flow card and category bars) and a borrowing entry card were subsequently removed — see the dashboard redesign below.

Added in the slice 1/2/5/6 pass:

- **Live deposit accounts (slice 1, partial).** `bff-customer` now serves `GET /api/customer/accounts`, resolving the caller's bank and customer from their token and returning only accounts where they hold a current view-permitting party role. A new `/api/accounts/party/{partyId}/viewable` query in account-service backs it and honours `can_view` and the role's validity window, unlike `/party/{partyId}`, which ignores both. Balances now carry `balanceAsOf` so the portal can state freshness. Tenant isolation is applied in the BFF, since account-service scopes by party alone.
- **Provenance-labelled account data.** The accounts screen reports whether its figures are live or sample, and why. When live accounts are served, sample transactions are deliberately *not* shown against them, and the mock-only account detail link is withheld, rather than mixing two datasets.
- **Explainable spending insights (slice 2).** `src/lib/spending-insights.ts` computes recurring payments and a savings projection as closed-form arithmetic. Every result carries the transactions it was built from behind a "How this was worked out" disclosure, and can be dismissed or re-categorised; corrections are persisted per profile and feed the same totals the rest of the page uses, so the two cannot disagree.
- **Honest confidence on recurrence.** Three or more settled payments at a steady gap are "Regular"; three or more at a varying gap are "Likely regular"; exactly two are reported as "Not enough history", because two points always look regular. Pending and declined transactions are excluded throughout.
- **Deterministic repayment estimates (slice 5).** The product page gained an indicative repayment panel using the standard annuity formula over the product's own published limits, printing its assumptions and a validity date. It is labelled "Not an offer".
- **Eligibility reframed as preparation (slice 5).** Headings no longer assert a decision ("You are eligible" → "You meet the published criteria"), every result states it is not a lending decision, and each `SKIPPED` criterion now names the missing evidence and links to where it can be supplied.
- **Application companion (slice 6).** `src/components/applications/ApplicationCompanion.tsx` renders one checklist per application — what is complete, what is missing, why each item matters, and whose turn it is — derived from the application record, the document summary and the task list. A source that fails to load removes its rows and says so, rather than implying the step is clear.

Deliberately not built: a period-over-period category comparison. On the available history the two halves hold very different numbers of transactions (19 recent against 6 older), so every category reported a large increase. That measured the shape of the sample, not any change in behaviour, and a category breakdown would in any case have restated the donut already on the page. This needs the backend intelligence feed before it can be done honestly.

### Dashboard redesign

The overview had accumulated marketing copy, three separate displays of the same spending figure, and two competing visual languages: the newer plum "intelligence" cards and the older bordered `.panel` / mesh-gradient chrome. The user's direction was that the newer design was the better one — so it now leads and the older chrome is gone, with the promotional copy stripped out of it.

Design standard, in `globals.css` as `.dash-*`:

- `.dash-hero` — the plum gradient card, full width, carrying one dominant figure.
- `.dash-card` / `.dash-card-head` / `.dash-card-title` / `.dash-card-foot` / `.dash-row` / `.dash-tile` — borderless `rounded-3xl` surfaces on `var(--surface-card)`, 24px gutters, sentence-case 16px titles, no divider under the header.
- `.dash-accent` — brand-tinted card for surfaces holding something prepared for the customer.

What changed:

- **The plum hero now leads and owns spending.** Total balance at 5xl/6xl is the single dominant number, with money in / money out and the category composition beside it in a translucent inset. The old spending donut panel was deleted rather than kept alongside, so the figures appear once.
- **Copy removed, not the design.** Gone: "Your money, in focus", "A little clarity. A lot of possibility.", "Your money tells a story. Here's the bigger picture.", "Less typing, more living", "Your next chapter", "Your AI. Your choice.", "A clearer view, always under your control.", and the 10px uppercase `intelligence-eyebrow` label pattern. The same pattern was stripped from the payments prefill panel, the personalisation panel and the application wizard header.
- **The cash-flow and composition figures now state their basis.** Money in/out counts settled transactions only; the split excludes transfers and says so, along with the real date range. Previously the composition total came from a different calculation than the number printed in the middle of its own donut, so the two disagreed. `monthlyInOut()` counted pending transactions as spent.
- **Old chrome deleted.** The `mesh-hero aurora` balance card, the `.panel`/`.panel-header` treatment on every dashboard surface, the accounts scroll-carousel (now a 4-up responsive grid), and the 12px uppercase labels on account cards and quick actions.
- **Removed the balance trend chart and its "+€X · Y%" chip.** `balanceTrend()` was the current total multiplied by a hardcoded 12-point wobble array — invented history, and the chip asserted a percentage change with nothing behind it. The function is deleted. The per-account sparklines were dropped from the dashboard for the same reason; there is no balance history to draw until a transaction feed exists.
- **Removed the relationship manager's "Online" presence badge.** It was hardcoded next to a hardcoded name, so it asserted a live presence state nothing could know. The contact actions remain.
- **Repeat shortcuts kept, reframed as a tool.** `PayAgain` replaces the promotional version: a Pay/Request segmented control using the existing `.segmented` classes, up to three previous transfers, and one line stating that it prefills for review and sends nothing. Gated by the existing `repeats` preference.
- **Updates folded into the rows they belong to.** Application signals are no longer a separate band repeating statuses that the application rows already show; each row carries a single "N updates" chip (hover for the signal types) and the detail lives in that application's own review.
- **The light content carries the hero's colour.** Quick-action and application-row icons are plum gradient medallions (`.dash-icon`), upcoming-payment date tiles are brand-tinted (`.dash-date-tile`), day-group headers are 14px semibold in the brand colour (`.dash-day`), and the pay-again card uses the brand-tinted `.dash-accent`. The pale-pink icon circles and grey date tiles that made the lower half read as a different product are gone.
- **Ordering:** hero → accounts → intelligence → quick actions → activity (transactions | pay again, upcoming payments) → applications + relationship manager.
- **Heading hierarchy repaired.** The layout deliberately renders its top-bar title as a `<p>` so each page owns its `<h1>`. The dashboard has a screen-reader `<h1>` of "Overview"; the balance figure is a `<p>`, since a number is not a section heading.

Provenance is still stated, as one quiet "Sample data" chip in the hero rather than a marketing badge line. It should be replaced by the live/sample flag from `accountService.getAccountsSnapshot()` once the dashboard reads accounts through it — the page still reads the sample dataset directly.

`MoneyHub.tsx` was deleted in the first pass and its design was rebuilt directly into the page rather than restored, so the hero and the cards are one consistent system instead of a component layered over older chrome.

## Recommended next slices

| Order | Experience | Status | Implementation direction |
| --- | --- | --- | --- |
| 1 | Trustworthy financial home | Partial — accounts live, transactions blocked | Accounts now come from the customer BFF with freshness and provenance. Transactions cannot follow until `credit.account_transaction` is reconciled with its entity and populated. Periods, loading/error states and sample-data labelling are in place; server-side preferences/consent is still browser-local. |
| 2 | Explainable spending insights | Done, on sample history | Recurring payments and a savings projection are deterministic, cite their source transactions, and support dismissal and correction. Calculated locally because customer intelligence emits no spending signals. Category comparison intentionally omitted. |
| 3 | Repeat payments and requests | Blocked | Needs a payment-request resource that does not exist in any backend service. Current behaviour is prepare-and-review only; no beneficiary, execution, authentication, idempotency or receipt support exists to build on. |
| 4 | Reusable document workspace | Not started | Link documents to applications; show source/page citations, per-field confidence, accept/edit, replacement versions and conflicts. Add an explicit tax-document schema before enabling tax extraction. |
| 5 | Eligibility preparation | Done | Requirements, missing evidence with a route to supply it, and a deterministic estimate carrying its assumptions and expiry, all separated from the bank's decision. |
| 6 | One application companion | Done | A persistent checklist showing what is complete, missing, why it matters and who acts next, from the application record, document summary and tasks. Writing confirmed facts back to the draft with provenance still needs the credit-journey integration. |
| 7 | Continuity across portals | Not started | Reuse customer-confirmed facts and document versions in RM, underwriting and solicitor views; expose proposals, approvals and execution history in a common timeline. |

## Journey design

Lead with useful actions, rather than an empty chat box: explain a spending pattern, prepare a familiar transfer, or resume an application. Use conversation where the customer's intent needs clarification.

Borrowing should follow: goal → suitable product → evidence → reviewed facts → application review → bank assessment → offer/signing/funding. Each step explains what happens next and preserves the draft. AI proposes and prepares; customers confirm changes and the bank decides credit.

Documents should follow: type → upload → processing → extracted facts with sources → accept/edit → draft update. Handle unreadable, unsupported, incomplete and conflicting evidence explicitly. Follow up on the existing extraction mapping: multi-month statements must not become one month's expenses, and payslip periods must be normalised before filling monthly income.

## Validation and remaining boundaries

Customer portal TypeScript, ESLint and the production build passed. Existing hook-dependency warnings remain in the AI assistant, application details, product loader and other unchanged screens. The build required network access to download the existing Inter font dependency.

An isolated browser with a synthetic customer and mocked API failures verified overview rendering, repeat amount/reference prefill, request preparation, persisted insight/document toggles and no horizontal overflow at 390px. Desktop and mobile dark-mode screenshots were visually inspected. Real backend extraction and payment execution were not exercised.

Banking remains a UI simulation. Document assistance depends on the existing extraction service. Tax extraction, live eligibility, real payment execution, request tracking and cross-device consent need backend implementation. No autonomous financial actions were added.

### Validation for the slice 1/2/5/6 pass

Verified:

- Customer portal `tsc --noEmit` clean and `next build` succeeds for all 25 routes.
- `next lint` reports 10 warnings, all pre-existing hook-dependency warnings in the AI assistant, application details, application wizard, company and product screens. None are in new code.
- `account-service` and `bff-customer` both compile and produce boot jars offline.
- The deterministic calculations were executed directly against the sample history in Node, including edge cases: empty history yields no projection and says so; a single transaction yields no recurrence; marking every transaction pending yields no recurrence; a category override propagates into the totals. The annuity formula reproduces published reference values exactly (200,000 at 4% over 240 months gives 1,211.96; 10,000 at 5% over 12 months gives 856.07), returns pure division at a zero rate, and returns nothing rather than a number for non-finite, zero or negative inputs.

Not verified, and the reason:

- **The new backend endpoints were never run.** No database or service was started, so `GET /api/customer/accounts`, the new `/viewable` JPQL query, the party-role filtering and the BFF's tenant isolation are unexercised. They compile; they have not been observed to work. The `balanceAsOf` addition changes `AccountSummaryResponse`'s all-args constructor, which no caller uses positionally, but that was checked by grep rather than by a full multi-module build.
- **The new UI was never rendered in a browser.** Verification needed a logged-in session, and injecting synthetic credentials into localStorage was declined by the tool safety layer; the user then chose to review the redesign themselves rather than authorise a local dev session. The accounts, insights, product, application and redesigned overview screens therefore have no visual or interaction confirmation — layout, 390px overflow and dark-mode contrast are unverified. The earlier browser verification described above predates all of this work.
- Real document extraction and payment execution remain unexercised.

Before this is relied on: start account-service and bff-customer against a database holding seeded accounts and party roles, confirm `/api/customer/accounts` returns them and returns nothing across tenants, then walk the four screens in a browser at desktop and 390px in both themes.
