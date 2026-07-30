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

> This file is deliberately plain ASCII. Rewriting it with a PowerShell one-liner
> once double-encoded the em-dashes and destroyed the status emoji outright, so
> the markers below are `[x]`, `[~]`, and `[ ]` rather than symbols.

---

## Progress

- `[x]` built **and verified** by a command in this repo
- `[~]` built, **not yet exercised** end to end
- `[ ]` not started

### Phase 1 - the 50% functional system (`Phase-1-50.pdf`)

Every item on the Phase 1 checklist is implemented.

**Web-Based Real Estate Portal**

- `[x]` Buyer registration, login, logout, profile
- `[x]` Display available units, search and filter, unit detail
- `[x]` Reserve a unit -> unit becomes **On Hold** -> reservation saved
- `[x]` Upload documentary requirements and proof of reservation payment

**Internal Management System**

- `[x]` Sales / Documentation / Admin login with distinct roles
- `[x]` View reservations, create walk-in reservations, update status
- `[x]` View and download documents, approve or reject each one
- `[x]` OCR reads uploaded files and displays the extracted text
- `[x]` Levenshtein comparison against buyer records, similarity score shown
- `[x]` Approve reservation -> **On Hold to Reserved** -> unit leaves the portal

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

That specification describes the full system, not Phase 1. These parts are
specified but not built:

- `[ ]` Structured address (house/street/barangay/city/province/ZIP)
- `[ ]` Civil status, nationality, TIN, suffix, sex
- `[ ]` Username-based login (the system uses email)
- `[ ]` CAPTCHA
- `[ ]` Parking as a sellable item
- `[ ]` Purchase price breakdown, payment terms, payment summary (Steps 3-5)
- `[ ]` Reservation reference format `RES-2026-000001`
- `[ ]` Studio Deluxe and Penthouse unit types; four of the five projects

---

## Two contradictions in the requirements

These are **not** code defects. The source documents disagree with each other,
and the choice belongs to the researchers and their adviser.

**1. When does a unit go On Hold?**

| Document | Says |
|---|---|
| `SUMMARY-OF-SYSTEM-PROJECT.pdf` | *immediately* on reservation |
| `manuscript.pdf` | once the request is *accepted for processing* |
| `DATABASE.doc` clause 2 | once *payment has been verified* |

**Built: immediately.** Anything later leaves a window in which two buyers can
reserve the same unit, which is the exact problem the study sets out to solve.

**2. Maximum upload size.** `manuscript.pdf` says 3 MB, `DATABASE.doc` says
10 MB. **Built: 3 MB.**

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
Units, open a type           60
Unit detail                   3
Staff, reservation queue      1
Staff, audit trail            3

A thorough visitor ~= 83 reads  ->  about 600 such visits per day
```

The catalogue reads five summary documents instead of the whole inventory, so
the cost does not grow with the number of units. **Develop against the emulator**
(`VITE_USE_EMULATOR=true`) and it costs nothing at all.

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
