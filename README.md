# SFSR-REMS

**An OCR-Based Real Estate Management System for St. Francis Square Realty
Corporation Using Levenshtein Distance for Automated Document Validation**

Two applications, one centralized Firebase database.

| Project | Folder | Port | Deployment | Users |
|---|---|---|---|---|
| Web-Based Real Estate Portal | `SFSR-Portal/` | 5173 | Online (Firebase Hosting) | Buyers and clients |
| Internal Management System | `SFSR-Internal/` | 5174 | Local / office LAN | Staff |
| Shared code | `SFSR-Shared/` | - | linked into both builds | - |

Setup, credentials, and daily commands are in **[SETUP.md](SETUP.md)**.

### Which document governs

| Document | Standing |
|---|---|
| `documentation/Phase-1-50.pdf` | **requirement** - defines the deliverable |
| `documentation/SUMMARY-OF-SYSTEM-PROJECT (1).pdf` | **requirement** - defines the workflow |
| `documentation/DATABASE.doc` | **requirement** - defines the forms and fields |
| `documentation/manuscript.pdf` | **reference only** |

`manuscript.pdf` is reference because its DFD and ERD figures describe a
different study (they name Tenants, Receptionist, Cashier, and Owner, none of
which appear in this system). Its narrative sections are still useful and are
cited where they were followed.

> This file is deliberately plain ASCII. Rewriting it with a PowerShell one-liner
> once double-encoded the em-dashes and destroyed the status emoji outright, so
> the markers below are `[x]`, `[~]`, and `[ ]` rather than symbols.

---

## Progress

- `[x]` built **and verified** by a command in this repo
- `[~]` built, **not yet exercised** end to end
- `[ ]` not started

### Phase 1 - the 50% functional system (`Phase-1-50.pdf`)

**All 26 sub-items on the Phase 1 checklist are implemented.** The wording below
is the PDF's own, item for item, so the mapping can be audited against it
directly. Where the build goes further or reads a requirement differently, that
is recorded under *Where the build and the requirements disagree*.

**Web-Based Real Estate Portal**

*User Registration and Login*
- `[x]` Buyer registration -- `RegisterPage.tsx`, creates `users/{uid}` with
  `role: buyer`, `accountType: initial`
- `[x]` Login and logout -- `LoginPage.tsx`, `AuthContext`
- `[x]` User profile -- `ProfilePage.tsx`, editable except the email

*Unit Listing*
- `[x]` Display available units -- `UnitsPage.tsx`
- `[x]` Search/filter units -- by project, type, floor, and price
- `[x]` View unit details -- `UnitDetailPage.tsx`, with floor plan, amenities,
  price, and promotion (`SUMMARY` Step 1 lists all five)

*Reservation Module*
- `[x]` Reserve a unit -- `ReservePage.tsx`
- `[x]` Unit changes to **On Hold** -- in the same transaction, not after it
- `[x]` Reservation saved in the database -- `reservations/{id}`

*Document Upload*
- `[x]` Upload required documents -- `DocumentUploader.tsx`, eight types
- `[x]` Upload proof of reservation payment -- with date, reference number,
  channel, and amount per `DATABASE.doc` Step 7
- `[x]` Files are saved correctly -- Cloudinary URL plus `publicId`, MIME type,
  and byte size recorded on the document row

**Internal Management System**

*Employee Login*
- `[x]` Sales/Admin login -- `StaffLoginPage.tsx`; buyers are refused
- `[x]` Different user roles (basic) -- sales, documentation, admin, enforced in
  `firestore.rules` as well as in the UI

*Reservation Management*
- `[x]` View reservations -- `ReservationsPage.tsx`, filterable by status
- `[x]` Create walk-in reservations -- `WalkInReservationPage.tsx`, through the
  same transaction as the online path
- `[x]` Update reservation status -- approve, reject, request additional
  documents, cancel

*Document Review*
- `[x]` View uploaded files -- `DocumentReviewItem.tsx`
- `[x]` Download/view documents -- opens the stored file in a new tab
- `[x]` Approve or reject documents -- per document, with a reason on rejection

*OCR Integration*
- `[x]` OCR reads uploaded files -- Tesseract.js in the browser; PDFs are
  rasterised with `pdfjs-dist` first
- `[x]` Display extracted text -- raw OCR text and the extracted fields, both
  shown in `ValidationPanel.tsx`

*Levenshtein Validation*
- `[x]` Compare OCR output with buyer information -- against the buyer snapshot
  taken at reservation time
- `[x]` Display similarity score or validation result -- the percentage, the
  edit distance, and the verdict are all shown

*Reservation Approval*
- `[x]` Approve reservation -- `approveReservation()`, transactional
- `[x]` Unit automatically changes from **On Hold** to **Reserved**
- `[x]` Unit disappears from available units on the portal -- asserted by
  `npm run verify`

### `SUMMARY-OF-SYSTEM-PROJECT (1).pdf` - the documented workflow

The seven online steps and the four walk-in steps, in order, plus the two
processes that follow them.

| Step | Built |
|---|---|
| 1. Browse without an account: details, floor plans, amenities, prices, promotions | `[x]` all five |
| 2. Create an account, then tripping / reserve / upload / monitor | `[x]` all four |
| 3. Reserve a unit; system immediately places it On Hold | `[x]` |
| 4. Upload documentary requirements (IDs, proof of billing, income, forms, other, proof of payment) | `[x]` the five named types, plus birth certificate, marriage certificate, and Special Power of Attorney standing in for "other" -- eight in all. Five are on the approval checklist; the rest are situational. |
| 5. OCR extracts full name, document type, ID number, date, address | `[x]` four fields in `extractFields.ts`; the document *type* comes from the Stage 1 classifier, not from field extraction |
| 6. Levenshtein compares with registration details; `JUAN DELA CRVZ` accepted | `[x]` distance 1, 92.9%, verdict `match`, asserted by `check:algorithms` |
| 7. Employee reviews OCR, validation, and completeness; may approve, reject, or request additional documents | `[x]` all three actions |
| 8. Approval moves the unit On Hold -> Reserved and removes it from the portal | `[x]` (see divergence 4 on "Reserved / Sold") |
| Walk-in path, all four steps | `[x]` same transaction as the online path |
| Section 5, Billing: SOA, proof of payment, balances, history | `[ ]` Phase 2 |
| Section 6, Cancellation: status `Cancelled`, records kept, unit returned to Available | `[x]` the transition; `[ ]` the 30-day trigger (see divergence 3 on who may cancel) |

### Beyond Phase 1

- `[x]` Audit trail, append-only, admin-only, cannot be edited or deleted
- `[x]` Requirements checklist gating approval, with an audited admin override
- `[x]` Request additional documents (keeps the unit's hold)
- `[x]` Reservation cancellation, returning the unit to the market
- `[x]` Two-stage validation: document **type** check, then **information** check
- `[x]` ID front and back capture, with the specific card declared and checked
- `[x]` Batch upload queue: several documents added, then uploaded and scanned
  in one pass
- `[x]` Data Privacy Act consent at registration, with wording version and
  timestamp
- `[x]` Reservation Terms and Conditions and Buyer's Declaration, recorded per
  application
- `[x]` Payment date, reference number, channel, and amount captured with the
  receipt
- `[x]` OCR and Levenshtein validation exercised on real uploads in a browser
  (5 of 5 documents carry genuine OCR text)
- `[~]` Site tripping requests (portal) and scheduling (internal)
- `[~]` Password rules: 8 characters, upper, lower, number, special

### Data and infrastructure

- `[x]` Normalised schema: `projects`, `unitTypes`, `units`
  (unit documents went from 1,280 to 378 bytes)
- `[x]` Security rules with role-based access, deployed
- `[x]` Composite indexes, deployed
- `[x]` Local emulator setup for zero-quota development
- `[x]` Idempotent migration, seeding, and repair scripts
- `[x]` Read-cost budget measured per screen

### Not started - Phase 2

- `[ ]` Statement of Account and billing
- `[ ]` Payment posting and verification workflow
- `[ ]` Loan monitoring, association dues
- `[ ]` The thirteen operational reports
- `[ ]` 30-day automatic cancellation
- `[ ]` View-only document viewer (no download, print, or screen capture)
- `[ ]` Notifications and announcements

### Not started - from `DATABASE.doc`

`DATABASE.doc` specifies the **whole** reservation application, in ten steps.
Phase 1 covers Steps 1, 2, 7, 8, 9, and 10. These parts are specified but not
built:

- `[ ]` Structured address, Step 1 (house/unit no., street, barangay, city,
  province, ZIP). Built: one free-text address field.
- `[ ]` Civil status, nationality, TIN, suffix, sex
- `[ ]` Username-based login and the 6-20 character username rule -- see
  divergence 5 above
- `[ ]` CAPTCHA ("I am not a robot")
- `[ ]` Remember Me on the login page
- `[ ]` Parking as a sellable item, Step 2 (space no., regular/premium/tandem,
  area, price)
- `[ ]` Purchase price breakdown, payment terms, payment summary (Steps 3-5):
  reservation fee, down-payment percentage, promotional discount, 6-36 month
  terms, bank / PAG-IBIG / cash financing, and every computed total
- `[ ]` Step 6 review-before-submit screen with `[ EDIT INFORMATION ]`
- `[ ]` Reservation reference format `RES-2026-000001`. Built: the Firestore
  document id.
- `[ ]` Four of the five projects named in Step 2. Built: **The Legaspi Place**
  only (Summit Residences, Parkview Heights, Harbor View Residences, Greenfield
  Gardens are not seeded). `scripts/unitData.ts` is shaped to take more.
- `[ ]` Two of the six unit types. Built: Studio, 1BR, 2BR, 3BR. **Studio Deluxe**
  and **Penthouse** are absent, and `DATABASE.doc` spells the others out as "One
  Bedroom" rather than "1BR".
- `[ ]` The permanent-account extras in the login note: view account details,
  view uploaded documents, SOA, payment history, announcements. The
  initial-to-permanent conversion itself **is** built.
- `[ ]` **BIR Form No. 1904 / TIN** as its own document type. Step 8 lists it
  separately from "Certificate of Employment / Proof of Income", but this build
  has no TIN document type and `"BIR FORM"` is a signature under
  `INCOME_DOCUMENT` -- so a BIR 1904 upload is classified as an income document.
  Adding `DocType.TIN_DOCUMENT` with its own signature would close this.
- `[ ]` **Other Supporting Documents** as a catch-all type. Anything not one of
  the eight defined types has nowhere to go, because Stage 1 needs a declared
  type to check against. A deliberate consequence of the two-stage design, but a
  gap against Step 8 all the same.

---

## Where the build and the requirements disagree

These are **not** code defects. In most cases the source documents disagree with
each other, and the choice belongs to the researchers and their adviser. Each
entry says what was built and why, so a decision can be reversed knowingly.

Priority order used throughout: `Phase-1-50.pdf` and
`SUMMARY-OF-SYSTEM-PROJECT (1).pdf` and `DATABASE.doc` are requirements;
`manuscript.pdf` is reference only.

**1. When does a unit go On Hold?**

| Document | Says |
|---|---|
| `SUMMARY-OF-SYSTEM-PROJECT.pdf` Step 3 | *immediately* on reservation |
| `DATABASE.doc` clause 2 | once *payment has been verified* |
| `manuscript.pdf` (reference) | once the request is *accepted for processing* |

**Built: immediately.** Anything later leaves a window in which two buyers can
reserve the same unit, which is the exact problem the study sets out to solve.
`Phase-1-50.pdf` also lists "Reserve a unit" and "Unit changes to On Hold" as one
module, with no payment step between them.

**2. Maximum upload size.** `DATABASE.doc` Steps 7 and 8 say 10 MB;
`manuscript.pdf` says 3 MB. **Built: 3 MB** (`MAX_UPLOAD_BYTES`), because OCR
runs in the buyer's browser and a 10 MB photograph is slow to rasterise on a
phone. One constant changes it.

**3. Who may cancel a reservation?**

`SUMMARY-OF-SYSTEM-PROJECT.pdf` section 6 says the reservation *"is manually
cancelled by the employee, subject to management approval."* **Built: staff can
cancel, and the buyer can also withdraw their own application** while it is
still `pending` or `under_review`. Once approved, the buyer is refused and told
to contact the sales office.

This is a deliberate addition, not an oversight. A buyer who changes their mind
otherwise leaves a unit held indefinitely, and the documents specify no way for
them to say so. If the adviser wants the documented behaviour exactly, remove the
withdraw control from the portal `ReservationDetailPage`; the rule that permits
it is `buyerReleasingOwnHold()` in `firestore.rules`.

**4. `Reserved` or `Sold`?** `SUMMARY-OF-SYSTEM-PROJECT.pdf` Step 7 writes the
outcome as "Reserved / Sold". `Phase-1-50.pdf` says only **Reserved**. Built:
approval sets `reserved`. The `sold` status exists in `constants.ts` and the
portal already excludes it, but **nothing in the system sets it** -- there is no
sale-completion step in Phase 1. It is reserved for Phase 2 billing, not dead by
accident.

**5. Username or email login?** `DATABASE.doc` specifies a **Username** (6-20
characters, letters and numbers) on both the registration and login pages. Built:
**email**, because Firebase Authentication identifies accounts by email and a
username layer would mean a second lookup collection and a uniqueness guard.
This affects both apps and is the largest single divergence from `DATABASE.doc`.

**6. Proof of payment before or after submission?** `DATABASE.doc` Step 7 places
the payment receipt *before* `[ SUBMIT RESERVATION APPLICATION ]`. Built: the
reservation is created first, then the receipt is uploaded from the reservation
page. A document row must point at a `reservationId`, and creating the
reservation is also what places the hold -- so uploading first would mean holding
files that belong to nothing. The receipt fields `DATABASE.doc` asks for
(payment date, reference number, channel, amount) are all captured.

**7. The portal shows On Hold units too.** `Phase-1-50.pdf` says "Display
available units". Built: `available` **and** `on_hold`, with the held ones
labelled and not reservable. Hiding them makes a nearly sold-out tower look
empty, and a buyer who saw a unit yesterday and cannot find it today assumes the
site is broken. Change `BROWSABLE` in `SFSR-Portal/src/units/useUnits.ts` to
restore the literal reading.

---

## Built but not in the documentation

Everything below is in the system and in **none** of the three requirement
documents. It is listed here so that nothing in the build is undeclared: a panel
asking "where is this in your specification?" should be able to find the answer
in this table rather than from the code.

Where an item comes from `manuscript.pdf`, that is said explicitly --
`manuscript.pdf` is reference, not requirement, so its contents count as
additions relative to the three priority documents.

### Correctness of the On Hold guarantee

| Addition | Why it exists |
|---|---|
| `runTransaction` around the hold | `SUMMARY` says the unit is placed On Hold "so that another buyer cannot reserve the same unit". A read-then-write loses that race. Objective 7 of the study is defensible only if the check and the write are one atomic commit. |
| `firestore.rules` role-based access control | The documents describe roles but not enforcement. Without database-level rules, "buyers cannot approve reservations" is a claim about the UI, not about the system, and a browser console defeats it. |
| `buyerPlacingHold()` pins price, unit no., type, project | A buyer's own client writes the hold. Nothing in the documents stops it from also rewriting the price. |
| `translateHoldFailure()` | When the rules layer wins the race instead of the transaction, the loser's browser reports `permission-denied`. It re-reads the unit so the buyer is told "already taken" and a genuine permissions fault is still reported as one. |
| `npm run check:rules` | Three suites that sign in as a **second real buyer** and attempt the attacks. A comment claiming a rule is safe is not evidence. |

### Depth of document validation

| Addition | Why it exists |
|---|---|
| Stage 1 document **type** check before the name check (`docPatterns.ts`) | From `manuscript.pdf`. `Phase-1-50.pdf` asks only that OCR output be compared with buyer information. Without a type check, a payslip uploaded as an ID is compared for name and can pass. |
| `tokenAlignedComparison` in `levenshtein.ts` | Philippine IDs print surname first. Flat string comparison scored a **correct** licence at 64.3% and would have rejected it. Token alignment scores the right person 91.7% and a different person 52.3%. This is an algorithmic change, and the negative case is asserted so it cannot be "fixed" by becoming permissive. |
| ID **front and back**, with the specific card declared | `DATABASE.doc` Step 8 asks for one file and a "Choose ID type" control. The back carries the address and signature, and declaring the card up front is what makes Stage 1 checkable. |
| Batch upload queue | The documents imply one file at a time. Staff and buyers add several documents, then upload and scan them in one pass; a single failure does not abandon the rest. |
| **Re-scan** button for staff | OCR runs in the buyer's browser, so the buyer's device produces the first result. Staff can re-run it against the stored file, held to the same standard including the declared ID subtype. |
| Verdict thresholds 0.85 / 0.70 and the raw score always shown | Thresholds from `manuscript.pdf`. Showing the number is what keeps this decision support rather than automation. |

### Accountability

| Addition | Why it exists |
|---|---|
| `auditLogs`, append-only | Not in any document. Every approval, rejection, cancellation, override, and account creation is recorded with the actor's name. `allow update, delete: if false` -- the trail cannot be edited even by an admin. |
| Requirements checklist that **gates** approval | `SUMMARY` Step 6 says the employee reviews "completeness of requirements". The gate makes that reviewable rather than remembered. |
| Audited admin **override** of that gate | A gate with no exit is worked around. The override is admin-only and writes the reason to the audit trail. |
| Consent stored with a version and a timestamp (`LEGAL_VERSION`) | `DATABASE.doc` supplies the wording; it does not say to record which wording a buyer agreed to. Terms change, and a consent record that cannot say *what* was consented to proves nothing. |

### Buyer experience

| Addition | Why it exists |
|---|---|
| Home, About, Contact, How It Works, Projects pages | The documents describe forms, not a public site. `SUMMARY` Step 1 requires browsing without an account, which needs somewhere to land. |
| On Hold units shown and labelled | See divergence 7. |
| Live password-rule checklist | `DATABASE.doc` lists the five rules; showing which ones are met as the buyer types is this build's. |
| Buyer-visible action items | A badge on reservations that need something from the buyer, driven by `under_review` status and rejected documents. Nothing in the documents tells the buyer *what* to do next. |
| Cascading unit picker for staff (type, then floor, then unit) | The documented alternative is "Selected unit". One dropdown of every available unit cost 317 reads to fill one control, and asked staff to scroll 317 items. |

### Data model, cost, and operations

| Addition | Why it exists |
|---|---|
| Normalised `projects` / `unitTypes` / `units` | No document specifies a schema. Amenities, images, and the floor plan were duplicated onto all 320 units; unit documents fell from 1,280 to 378 bytes. |
| Aggregation counts, pagination, lazy search listener, persistent cache | The free Spark plan allows 50,000 reads per day and one day of development consumed 52,000. See the read budget below. |
| `reservations.buyer{}` snapshot kept denormalised | Deliberate, and the opposite of the above: the buyer's details as they were **at reservation time** are what the Levenshtein check was run against. A later profile edit must not rewrite history. |
| Local Firebase emulator setup | Development against the live project is what exhausted the quota. |
| Staff accounts created through a secondary Firebase app instance | Admin creates employee logins without a paid Cloud Function and without losing their own session. |
| Idempotent migrate / seed / normalise / repair scripts | `normalizeUnits.ts` refuses to run twice. The migration that populates rules, indexes, the admin, and the inventory can be re-run safely. |
| `npm run verify`, `measure`, `inspect:state`, `diagnose`, `check:*` | Every claim in this README is backed by a command anyone can re-run. |

### Failure reporting

| Addition | Why it exists |
|---|---|
| An error callback on **every** `onSnapshot`, and every screen telling a failed listener apart from an empty result | Without it, a rules rejection renders as "Reservation not found", "No reservations yet", "Unit not found", or an empty staff table meaning "there are no other administrators". Each is a confident false statement that sends someone to fix the wrong thing. One such empty dropdown already cost real debugging time on this project. |

---

## What has actually been proven

Every claim here is backed by a command anyone can re-run.

| Check | Command | Result |
|---|---|---|
| Levenshtein and document-type detection | `npm run check:algorithms` | 14 checks pass, including the manuscript's `JUAN DELA CRVZ` example: distance 1, 92.9%, verdict `match` |
| Real Philippine ID names, right person vs wrong person | `npm run check:ids` | all pass; correct buyer 91.7%, different buyer 52.3% |
| Security rules resist a second buyer | `npm run check:rules` | all pass across three suites; a buyer cannot release another buyer's hold |
| Full reservation lifecycle against live Firestore | `npm run verify -- <email> <pw>` | 14 checks pass, including two simultaneous reservations on one unit where exactly one wins |
| Read cost per screen | `npm run measure -- <email> <pw>` | Home 9, Browse 8, Open a type 24, Unit detail 3 |
| What the database actually holds | `npm run inspect:state` | catalogue health plus whether OCR really ran |
| Types compile across all four projects | `npm run typecheck` | clean |
| Both apps build | `npm run build` | clean |

Every `onSnapshot` listener in both apps now has an error callback, and every
screen tells a failed listener apart from an empty result. This is not cosmetic:
without it a rules rejection renders as "Reservation not found", "No
reservations yet", or an empty unit dropdown -- each of which is a confident
false statement that sends someone to fix the wrong thing. One such empty
dropdown already cost real debugging time on this project.

### OCR in a real browser: proven

`npx tsx scripts/inspectState.ts --live` on the live project reports:

```
documents: 5
  valid_id  drivers_license  [pending ]  ocr=559 chars  conf=68%  similarity=100.0%  verdict=match
  valid_id  drivers_license  [approved]  ocr=559 chars  conf=68%  similarity= 20.7%  verdict=mismatch
  ...
  -> 5 of 5 carry real OCR text
```

Every uploaded document has genuine OCR output, so Tesseract has run in a
browser on a real photograph of a driver's licence -- not only in the offline
checks.

The similarity spread is the algorithm behaving correctly rather than
inconsistently: the same licence scored **100%** against the buyer it belongs to
and about **20%** against a different buyer's reservation. Matching the right
person and refusing the wrong one is the whole point of Stage 2.

Note that three documents were **approved despite a `mismatch` verdict**. That is
permitted by design -- the manuscript positions automated validation as decision
support, never as the approver -- and each override is recorded in the audit
trail with the staff member's name.

---

## Firestore read budget

The free Spark plan allows 50,000 document reads per day. A day of development
once consumed 52,000 against only 712 writes, because Firestore bills a read per
document *every time a listener attaches*, and Vite re-attaches every listener
on every file save.

Current cost, measured rather than estimated:

```
Home page                     9 reads
Units, browsing               8
Units, open a type           24     (one page of floors)
Unit detail                   3
Staff, walk-in unit picker    6     (was 317)
Staff, reservation queue      6
Staff, audit trail           22     (on open and on Refresh only)

A thorough visitor ~= 47 reads  ->  about 1,063 such visits per day
```

The catalogue reads five summary documents instead of the whole inventory, so
the cost does not grow with the number of units. **Develop against the emulator**
(`VITE_USE_EMULATOR=true`) and it costs nothing at all.

Re-run `npm run measure -- <email> <pw>` after changing any query; the page sizes
live in `SFSR-Shared/src/constants.ts` so the measurement cannot drift from the
app. It did drift once, and this table read 60 for a screen that costs 24.

---

## Repository layout

```
.env                      one file, both apps, gitignored
firestore.rules           role-based access control
firestore.indexes.json
firebase.json             Hosting serves SFSR-Portal only

SFSR-Shared/src/
  levenshtein.ts          distance, normalisation, token-aware matching
  ocr.ts                  Tesseract worker, PDF rasterisation
  docPatterns.ts          document type signatures
  validateDocument.ts     stage 1 type check, then stage 2 name match
  extractFields.ts        field extraction from OCR text
  reservations.ts         the On Hold transaction
  legal.ts                consent text, terms, declarations
  password.ts             password rules
  ui/                     uploader, validation panel, document hooks

SFSR-Portal/src/pages/    14 pages
SFSR-Internal/src/        7 pages plus document review

scripts/                  migration, seeding, verification, measurement
documentation/            the four source documents
```

---

## Scripts worth knowing

```bash
npm run setup                      install all four projects
npm run emulators                  local Firebase, no quota used
npm run migrate -- <email> <pw>    rules + admin + inventory, idempotent
npm run seed:staff                 one demo account per role
npm run repair:catalogue           rewrite project/type metadata from source

npm run check:algorithms           offline, no Firebase
npm run verify -- <email> <pw>     full lifecycle, cleans up after itself
npm run measure -- <email> <pw>    read cost per screen
npm run inspect:state              what the database actually holds
npm run diagnose -- <email> <pw>   run the app's own queries and report

npm run deploy:rules               rules and indexes
npm run deploy:portal              build and publish the Portal
```

Add `-- --live` to a maintenance script to target the real project even while
`.env` points at the emulator. Each script prints which one it hit.

**Two flag names to avoid:** npm consumes `--production` and `--dry-run` as its
own options, so they never reach a script. This repo uses `--live` and `--plan`
instead, and both refuse to run if the npm-reserved spelling is passed.
