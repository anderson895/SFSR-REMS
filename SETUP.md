# SFSR-REMS -- Setup

St. Francis Square Realty Real Estate Management System.

**Two separate projects, one shared database.**

| Project | Folder | Runs at | Deployment | Audience |
|---|---|---|---|---|
| Web-Based Real Estate Portal | `SFSR-Portal/` | :5173 | **Deployed online** (Firebase Hosting) | Buyers / clients |
| Internal Management System | `SFSR-Internal/` | :5174 | **Local / office LAN only** | Staff |
| Shared code | `SFSR-Shared/` | -- | not deployed on its own | both projects |

`SFSR-Portal` and `SFSR-Internal` are independent npm projects -- separate
`package.json`, separate `node_modules`, separate install, build, and deploy.
Neither imports the other.

They both link `SFSR-Shared` (`file:../SFSR-Shared`), so the Levenshtein
algorithm, OCR, Firestore types, and security-relevant logic exist in exactly
one place instead of drifting apart in two copies.

**The database is deliberately NOT separated.** Both projects read the same
`.env` at the repo root and therefore the same Firebase project (`sfsr-rems`).
The study requires a centralized database so that a change made in one system
appears immediately in the other -- a reservation filed on the Portal shows up
in the Internal system, and an approval there removes the unit from the Portal.

```
                 .env  (one Firebase project)
                   |
      +------------+------------+
      |                         |
 SFSR-Portal              SFSR-Internal
 (online)                 (office LAN)
      |                         |
      +---- SFSR-Shared --------+
            (linked, not copied)
```

---

## 1. Install

Installs the root tools plus all three projects:

```bash
npm run setup
```

Or install one project on its own:

```bash
cd SFSR-Portal && npm install
```

Requires Node 18+ (tested on Node 22).

## 2. Credentials

Copy `.env.example` to `.env` and fill it in. The `.env` file is gitignored --
never commit it.

```bash
cp .env.example .env
```

The Cloudinary **API Secret is not needed** and must never be placed in `.env`:
anything prefixed `VITE_` is bundled into the browser JavaScript. Unsigned
uploads need only the cloud name and the upload preset.

## 3. Run the migration

One command sets up the entire Firebase backend:

```bash
npm run migrate -- <adminEmail> <adminPassword>
```

It performs four steps:

1. Deploys `firestore.rules` and `firestore.indexes.json`
2. Creates (or promotes) the administrator account
3. Seeds the demo property inventory, if `units` is empty
4. Prints a count of every collection

**Idempotent** -- re-running reports what already exists and changes nothing, so
it is safe after a failure partway through or on an already-configured project.
It never deletes data.

To skip the rules deploy and only touch data:

```bash
npm run migrate:data -- <adminEmail> <adminPassword>
```

### Why this needs Google credentials

`firestore.rules` deliberately prevents anyone from registering themselves as
staff -- self-registration is pinned to the `buyer` role, and only existing staff
may create staff accounts. Without that guard, any stranger on the internet
could make themselves an administrator.

So the first admin cannot be created *through* the app, by design. The
migration uses the Firebase Admin SDK, which bypasses the rules using real
Google credentials. Pick either:

**Option A -- gcloud**

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project sfsr-rems
```

**Option B -- service account key**

Firebase Console -> Project settings -> Service accounts -> *Generate new private
key*. Save it as `serviceAccountKey.json` in the repo root (already gitignored).
The migration prefers this file if it is present.

Every staff account after the first is created inside the app:
**User management -> Create staff account** -- no credentials needed.

## 4. Optional: seed units without admin credentials

If an admin already exists and you only need inventory, this writes through the
normal client SDK, so the security rules apply exactly as they do for the apps:

```bash
npm run seed -- <adminEmail> <password>
```

---

## Daily commands

From the repo root:

```bash
npm run migrate -- <email> <pw>   # set up / re-check the Firebase backend
npm run dev:portal        # buyer portal    -> :5173
npm run dev:internal      # staff system    -> :5174 (also on the LAN)
npm run typecheck         # all three projects
npm run build             # production build of both apps
npm run check:algorithms  # Levenshtein + document-type checks, no browser needed
```

Or work inside one project on its own -- it does not need the root scripts:

```bash
cd SFSR-Internal
npm run dev
npm run build
```

## Developing without burning Firebase quota

The free Spark plan allows **50,000 Firestore reads per day**. That sounds
generous and is not: Firestore bills one read per document *every time a
listener attaches*, and Vite re-attaches every listener on every file save. A
single day of editing this project consumed 52,000 reads against only 712
writes -- a 73:1 ratio -- and locked the database for the rest of the day.

**Develop against the local emulators.** They cost nothing, work offline, and
enforce the same `firestore.rules`.

```bash
# .env
VITE_USE_EMULATOR=true
```

```bash
npm run emulators      # terminal 1 -- keeps data in .emulator-data/
npm run dev:internal   # terminal 2
```

Seed the emulator the same way as the real project -- the scripts follow the
same flag, so they write to whichever target the apps are using:

```bash
npm run migrate:data -- admin@example.com password123
```

Emulator UI: http://127.0.0.1:4000 - requires Java (already installed if
`java -version` works).

Set `VITE_USE_EMULATOR=` (blank) to point back at the real project. The console
logs which target is active on startup, so there is no guessing.

### If you do hit the limit

Quota resets at **midnight US Pacific time** (about 3--4 PM Manila). Nothing is
lost or broken; reads simply fail until then. Switch to the emulator and keep
working.

### What was done to reduce reads

- Firestore now uses a **persistent on-disk cache**, so a re-attaching listener
  resyncs from IndexedDB and pays only for documents that actually changed.
- The audit trail **fetches once with a Refresh button** instead of holding a
  live 300-document listener. That listener alone cost 300 reads per hot reload
  and was the single largest consumer.

## Demo staff accounts

```bash
npm run seed:staff                  # emulator, or whatever .env points at
npm run seed:staff -- --live  # the live project
```

Creates one account per role, so role-based access control can be shown rather
than described -- sign in as each and watch the navigation and the permitted
actions change.

| Role | Email | Password | Sees |
|---|---|---|---|
| `admin` | admin@sfsr.test | `Admin@2026` | Everything, plus user management and the audit trail |
| `sales` | sales@sfsr.test | `Sales@2026` | Reservations, walk-in creation, approve and reject |
| `documentation` | docs@sfsr.test | `Docs@2026` | Document review, OCR and Levenshtein results |

Idempotent: re-running resets the passwords and merges the profiles rather than
creating duplicates, which is the quickest fix for a forgotten demo password.

These passwords are published in this file. They are meant for the emulator and
for a demo; change them before the project holds anything real.

## Deploying

Only the Portal goes online. The Internal Management System is office-based and
is never published to Hosting -- `firebase.json` points Hosting at
`SFSR-Portal/dist` only.

```bash
npm run deploy:rules     # firestore.rules + indexes
npm run deploy:portal    # builds SFSR-Portal, then deploys Hosting
```

To run the Internal system on the office LAN, start it on the server machine and
reach it from other PCs at `http://<server-ip>:5174` (it already binds to all
interfaces).

## A note on the shared package

`SFSR-Shared` is linked, not copied. Editing `SFSR-Shared/src/levenshtein.ts`
changes both apps at once -- that is the point, since the algorithm must behave
identically on both sides.

Because npm installs a `file:` dependency as a symlink, both Vite configs set
`resolve.dedupe` for `firebase`, `react`, `react-dom`, `tesseract.js`, and
`pdfjs-dist`. Without it, Vite could load two separate copies of the Firebase
SDK -- one via the shared package, one via the app -- and `getApps()` in one would
not see the app created by the other, so a signed-in user would appear signed
out to half the code. Do not remove that setting.

If you zip a project to hand it off, **include `SFSR-Shared` and the root
`.env`**, or the build will not resolve.

## Roles

| Role | Where they sign in | Access |
|---|---|---|
| `buyer` | Portal only | Own reservations, own documents, own profile |
| `sales` | Internal only | Reservations, walk-in creation |
| `documentation` | Internal only | Document review, OCR/validation results |
| `admin` | Internal only | Everything, including user management |

A buyer account is refused by the Internal system, and a staff account is
refused by the Portal -- both in the UI and in `firestore.rules`.

## Every write requires an account

There is no anonymous write path anywhere in the system. Browsing is public --
`units` is readable by anyone, which the study requires -- but creating a
reservation, uploading a document, or booking a site visit all need a signed-in
buyer.

An earlier draft of `trippingRequests` accepted anonymous submissions to
capture cold leads. That made it the one collection a stranger could write to,
and Firestore rules cannot express a rate limit, so it would have needed App
Check to be safe against flooding. Requiring sign-in removed the hole instead
of mitigating it: every request now carries a uid that Firebase Auth can trace,
disable, or throttle.

The shape checks remain on top of that, because authentication says *who* is
writing, not that what they wrote is sane. `scripts/checkTrippingRules.ts`
exercises both halves:

```
npm run check:rules
```

## Phase 1 module coverage

Mapped against `Phase-1-50.pdf`.

**Web-Based Real Estate Portal**

| Module | Where |
|---|---|
| Buyer registration - login/logout - profile | `SFSR-Portal/src/pages/{Register,Login,Profile}Page.tsx` |
| Display - search/filter - unit details | `SFSR-Portal/src/pages/Units{,Detail}Page.tsx` |
| Reserve a unit - On Hold - saved to database | `SFSR-Shared/src/reservations.ts` |
| Upload requirements - proof of payment | `SFSR-Shared/src/ui/DocumentUploader.tsx` |

**Internal Management System**

| Module | Where |
|---|---|
| Sales/Admin login - user roles | `SFSR-Internal/src/auth/RequireStaff.tsx`, `firestore.rules` |
| View - create walk-in - update status | `SFSR-Internal/src/pages/{Reservations,WalkInReservation}Page.tsx` |
| View/download documents - approve or reject | `SFSR-Internal/src/components/DocumentReviewItem.tsx` |
| OCR reads files - displays extracted text | `SFSR-Shared/src/ocr.ts` |
| Levenshtein comparison - similarity score | `SFSR-Shared/src/{levenshtein,validateDocument}.ts` |
| Approve - On Hold -> Reserved - leaves portal | `approveReservation()` + portal query filters on `available` |

## Verification

Two suites, neither of which needs a browser.

```bash
npm run check:algorithms            # offline, no Firebase
npm run verify -- <email> <pw>      # live, against the real project
```

`check:algorithms` asserts the manuscript's worked example -- OCR reading
`JUAN DELA CRVZ` for `JUAN DELA CRUZ` gives distance 1, ~92.9% similarity,
verdict `match` -- plus document-type detection and a negative case.

`verify` runs the whole reservation lifecycle against live Firestore, importing
the **same** `createReservation` / `approveReservation` the apps call, through
the ordinary client SDK so `firestore.rules` applies exactly as it does to a
real user. It checks 14 things, including:

- two simultaneous reservations on one unit -> **exactly one wins**
- a buyer cannot set their own `role` to `admin`
- a buyer cannot seize a unit that is already on hold
- a buyer cannot read another buyer's reservation, or approve their own
- approval moves the unit `on_hold -> reserved`, upgrades the buyer to a Client
  Account, and removes the unit from the portal listing

It creates a throwaway buyer, rival, and reservation, then deletes them and
restores the unit. Run it any time; it leaves nothing behind.

## Account types

A buyer registers with an **Initial Account**. When staff approve their
reservation it becomes a **Client Account**, unlocking the Client Portal. This
conversion happens inside the approval transaction in
`packages/shared/src/reservations.ts`.
