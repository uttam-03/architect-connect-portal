# Audit, changes and verification

This is a targeted code audit and functional repair, not a guarantee that all possible bugs have been eliminated.

## Fixed findings

| Finding | Change |
|---|---|
| Seed used sync({force:true}), dropping existing data | Transactional additive demo seed; repeat run skips existing dataset; never run automatically |
| Inquiry architectFeeBudget/materialBudget columns existed but were absent from ORM | Model fields restored; additive migration retains existing rows |
| Portfolio update accepted arbitrary body fields | Explicit editable-field list; designerId, status and view counters immutable through owner edits |
| Project could jump to completed or reopen terminal states | Pending to accepted/rejected by designer; accepted to completed by client only |
| Dashboard expected nested clientId/designerId, API returned UUIDs | Inquiry serialization now matches the UI contract |
| Registration could leave a designer without a profile | User and profile created inside one transaction; email/type validation added |
| Portfolio count could diverge after partial create/delete | Portfolio writes and counter updates share a transaction |
| Private/rejected portfolio exposed by public detail endpoint | Public detail requires published status |
| Inactive designer visible by direct URL | Active-user check on profile detail |
| Invalid saved targets accepted; repeat saves failed | Validate target designer and use findOrCreate |
| Decimal ratings accepted and admin review deletion left stale stats | Integer 1–5 validation and aggregate recalculation on deletion |
| Unvalidated admin status and self-suspension | Boolean/enum validation and self-suspension guard |
| Missing price-range/array validation | Non-negative numeric and range checks on profile writes |
| Hardcoded localhost API and no bundled frontend host | Same-origin /api, Vite development proxy, Express static files and SPA fallback |
| Render recipe had no complete persistent setup | Paid web service + mounted disk, explicit SQLite path, health check, startup path guard |
| No reliable database backup/import workflow | WAL, busy timeout, foreign keys, graceful close, consistent VACUUM INTO backups, non-overwriting import tool |
| Missing payment flow | Server order, HMAC verification, captured amount/order/currency checks, signed webhook, unique inquiry payment, order retry protection, receipt/status UI |
| Requests failed without visible feedback | Dismissible API error notice, form-level errors and payment cancellation/processing state |
| Dated visual styling | Forest/limestone palette, cards, focus styles, mobile spacing and payment panel |
| Missing completed-project review UI | Review form on completed client projects |

## Verification performed

- Backend integration suite: registration, invalid email, inquiry fee/material roundtrip, participant authorization, invalid/valid state transitions, message persistence, portfolio ownership protection, decimal/duplicate review rejection, invalid payment signature, signed captured webhook, webhook replay, tampered webhook rejection, server restart persistence and consistent database backup.
- Safe database import succeeded; repeat import to the same destination was refused.
- Frontend production build passed after dependency upgrades.
- Fresh demo seed produced 21 users, 20 portfolios and 30 inquiries; second run skipped without changes.
- Original database quick_check returned ok. Additive migration applied to a disposable copy; original and migrated copy both retained 21 users, 30 inquiries and 20 portfolios.
- Historical fee/material values already discarded by the old model cannot be recovered automatically. A separate fresh trial database with valid fees is included.
- Dependency audit after updates reported zero vulnerabilities for both lockfiles. Backend installation in this workspace required a temporary, installation-only adapter for unsupported filesystem ownership calls; that adapter is not shipped or needed for ordinary Windows/Render installs.
- In the first revision the original databases were unchanged. The fee/data revision now updates the ten known demo designer profiles and their sample portfolios in the active packaged database; a pre-update SQLite backup is included under backend/data/backups. Original inquiry, account and payment IDs are retained. Packaged source excludes installed node_modules and environment secrets.

## Limits and operational work

- Razorpay network orders, live/test financial transactions and account activation were not tested: merchant keys are required. Payment webhook and signature behavior were tested locally. Configure auto-capture and test gateway cancellation/retry/browser-close flows before launch.
- No live Render deployment was performed; repository connection and Render billing/account setup remain user actions. Local process restart persistence was verified; complete the documented Render restart/redeploy acceptance test after deployment.
- Browser screenshot QA could not run: Chromium was absent and its download failed. CSS is responsive by implementation; visual device review remains necessary. Frontend compilation passed.
- External Unsplash images/Google Fonts need network access; images are demo references. Portfolio image URLs are supported; Cloudinary uploads, media moderation, password recovery, email verification, automatic refunds/payouts, escrow and real-time chat are not implemented.
- MySQL configuration remains, but the executed integration tests use SQLite. Switching databases does not migrate existing data.
- A signed but mismatched captured payment is rejected. An uncertain provider-order creation is blocked for manual reconciliation rather than creating a duplicate charge opportunity.
- Backups on the same disk do not protect against loss of that disk. Offsite backup copies, restore drills and disk monitoring remain required. No absolute zero-data-loss promise is made.
- Existing public demo accounts should not be used unchanged on a real merchant site.

## Architect data and fee revision

Found that all ten original designer profile fee ranges were zero and bios were identical. Also, directory cards had no fee display. Added ten distinct fictional sample profiles/projects, visible fees on directory cards, robust min-only/max-only price labels and permanent dashboard field labels. Added `npm run demo:update` for existing installations; it scopes writes to known demo designers, backs up SQLite first and preserves non-sample projects. Both active and separate trial databases are updated. Directory/profile API fee roundtrip is covered by integration tests.

## Expanded data revision

Added 20 more fictional architects and 60 additional portfolios, bringing packaged totals to 30 architects, 80 projects and 41 users. Existing 30 inquiries and 20 reviews were retained. Repeat expansion added zero duplicate accounts/projects. All sample architects have positive design fees. Public portfolio collection limits were increased to accommodate all 80 samples. No extra payment or review history was fabricated.

## Image revision

Replaced repeated sample image assignments with bundled, distinct architecture/reference photos. Image updates are scoped to recognized demo accounts and exact sample-project titles; no inquiry or payment records are changed. Credits and original-source license links accompany the media assets.

Image verification: both packaged databases reference 110 distinct local image files (30 studio references and 80 project covers). All 110 files have distinct SHA-256 hashes and are present in the production build. Backend integration tests and frontend build passed. Selected photo contact sheets were visually reviewed; browser screenshot QA remains unavailable as noted earlier.
