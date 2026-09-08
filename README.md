# QMfg Mobile — Phase 0 + Phase 1 + Phase 2a + Phase 2b (BOM)

React Native/Expo port of QMfg-Frontend. Delivered so far: **Phase 0**
(auth, navigation shell, theme tokens, reusable primitives); **Phase
1** — 10 simple CRUD/report pages (Units, Machines, Operators,
Suppliers, Customers, Equipment Master, Overheads, Job Workers, Stock
Alerts, Tenants); **Phase 2a** — Raw Materials, Finished Products,
Reorder, Other Expenses; and, from **Phase 2b**, **BOM/BomEdit**.
Production, Sales, Receipts, Payables, and Salaries are still open —
see "Phase 2b — still not built" below.

## What's here

```
App.tsx                        entry point: i18n boot, providers, nav
app.config.ts                  Expo config; API URL via EXPO_PUBLIC_API_URL
eas.json                       EAS build profiles (preview/production)
src/
  theme/tokens.ts              ported from index.css :root variables
  lib/
    storage.ts                 SecureStore (tokens) + AsyncStorage (prefs)
    api.ts                     ported request()/auth/companies + all
                                Phase 1 domain endpoints
  context/AuthContext.tsx      ported, adapted for async storage
  i18n/                        react-i18next, en/hi locales copied as-is
  navigation/
    RootNavigator.tsx          swaps Auth ↔ App navigator on auth state
    AuthNavigator.tsx          Login, ForgotPassword, ResetPassword
    AppNavigator.tsx           Drawer; registers every NAV screen
    navConfig.ts                ported NAV array from Layout.tsx
    DrawerContent.tsx           ported grouped/collapsible sidebar
    linking.ts                  deep link config for password reset
  components/
    ui/                        Button, Card, TextField, Select,
                                 ListRow, EmptyState, ErrorBanner,
                                 LanguageToggle
    crud/
      MasterCrudScreen.tsx      generic list+search+create/edit screen
                                 driving 8 of the 10 Phase 1 pages
      FieldForm.tsx              renders a form from a FieldConfig[]
      types.ts                   FieldConfig type
  screens/
    auth/                      Login, ForgotPassword, ResetPassword
    app/
      DashboardScreen.tsx      Phase 0's one real authenticated screen
      PlaceholderScreen.tsx    shown for every not-yet-built nav item
      UnitsScreen.tsx          ┐
      MachinesScreen.tsx       │
      OperatorsScreen.tsx      │
      SuppliersScreen.tsx      │ Phase 1 — all built on MasterCrudScreen,
      CustomersScreen.tsx      │ ~30-60 lines each (field config + api calls)
      EquipmentMasterScreen.tsx│
      OverheadsScreen.tsx      │
      JobWorkScreen.tsx        ┘ (master list only — see note below)
      StockAlertsScreen.tsx    bespoke — read-only report, two tabs
      TenantsScreen.tsx        bespoke — impersonation-based edit flow
```

## Phase 1 scoping notes (read before building against these)

- **Job Workers**: only the master list (create/edit job worker
  profiles) is built. The web app's "Activity" tab on the same page —
  dispatching raw material to a job worker, recording finished-goods
  receipts back, running balances/payables — is a transactional
  workflow with its own state machine. That belongs with
  Production/Receipts in **Phase 2**, not here.
- **Overheads**: every overhead created here is "General" (`fg_id:
  null`). The web app also supports linking one overhead to a specific
  Finished Product — that selector needs the Finished Products list,
  which ships in Phase 2. Add an `fg_id` select field to
  `OverheadsScreen.tsx` once that exists.
- **Stock Alerts** and **Tenants** don't use `MasterCrudScreen` — the
  former is read-only (no create/edit at all), the latter's edit flow
  uses a company-impersonation trick (`x-company-id` header swap) that
  doesn't fit the generic id-based update pattern.

## The MasterCrudScreen pattern

8 of the 10 pages are ~30-60 line files that just configure
`MasterCrudScreen` with:
- a `FieldConfig[]` describing the form (label, type, options)
- the matching `api.list*`/`create*`/`update*`/`deactivate*` functions
- how to render each row's title/subtitle/badge

When you build Phase 2's simpler forms-with-logic pages, check
whether they fit this same shape before hand-rolling a new screen —
several (Raw Materials, Finished Products) likely do, with an extra
field or two.

## Setup

You don't have local CLI access, so the practical path is: push this
to a GitHub repo, then run builds through **EAS's cloud build service**
(no local Android SDK needed) — either via the Expo website's GitHub
integration, or from Codespaces/any machine with `npx` for the
one-time `eas build` trigger.

1. Create an Expo account + project: https://expo.dev
2. Set your API URL as a secret per environment (Expo dashboard →
   your project → Environment variables), matching the `EXPO_PUBLIC_API_URL`
   placeholders in `eas.json`. Point `preview` at whatever
   Railway URL you're using for QMfg's backend right now.
3. Push this repo, then trigger a build:
   ```
   eas build --platform android --profile preview
   ```
   (via Expo's website "Build" tab if you don't have a shell handy —
   it can build directly from a connected GitHub repo.)
4. Install the resulting `.apk` on a device via the link EAS gives you,
   or use **Expo Go** during active development for faster iteration
   (`npx expo start`, scan the QR code — works from Codespaces too, as
   long as your phone can reach the tunnel URL).

## What to check once it's building

- Login screen loads, hits your real `/api/auth/login`, and lands on
  the Dashboard drawer.
- Every Phase 1 item in the drawer opens a real screen: list loads,
  search works, tapping "+" opens a create form, tapping a row opens
  an edit form with the toggle-able Active switch.
- Tenants: create flow (company + owner), and editing an existing
  tenant — confirm the active-company header gets restored afterward
  (check that a subsequent screen still shows your own data, not the
  tenant's).
- Stock Alerts: both tabs load; badges color-code by urgency.
- Everything else in the drawer still opens `PlaceholderScreen` —
  expected, that's exactly where Phase 2 starts.

## Continuing into Phase 2

For each of the transactional pages (Raw Materials, Receipts,
Payables, Finished Products, Production, Reorder, Sales, BOM, Other
Expenses, Salaries):

1. Copy that domain's types + `api.*` methods from
   `QMfg-Frontend/src/lib/api.ts` into `src/lib/api.ts` here.
2. Check whether `MasterCrudScreen` fits (simple list + form) before
   building a bespoke screen — Raw Materials and Finished Products
   likely do; Production/Sales (multi-line items, calculated totals)
   probably don't and need their own screen, same as StockAlerts/
   Tenants did in Phase 1.
3. In `AppNavigator.tsx`, add the screen to `SCREEN_COMPONENTS` and
   flip `implemented: true` on its `navConfig.ts` entry.

---

## Phase 2a (this update)

Added 4 more pages: **Raw Materials**, **Finished Products** (both on
`MasterCrudScreen`, with a live Units-fed dropdown instead of free
text for the unit field), **Reorder** (bespoke — dashboard variant of
Stock Alerts' RM tab, adds a summary card), and **Other Expenses**
(`MasterCrudScreen`, but a transaction log rather than master data —
no Active toggle, a real "Delete expense" button instead, via a new
`deactivateFn`-powered delete action added to `MasterCrudScreen`
itself, so all earlier Phase 1 screens picked up a working
deactivate/delete button too).

## Phase 2b (in progress)

**BOM / BomEdit — shipped this update.** Two new files:

- `screens/app/BomScreen.tsx` — ports `pages/Bom.tsx`: one row per
  finished product, "with active BOM" / "need BOM setup" summary
  tiles, search. Tapping a row (or the top-bar "+") opens the editor.
- `screens/app/BomEditScreen.tsx` — ports `pages/BomEdit.tsx`: FG
  picker, raw-material line editor (qty per unit FG, live per-line
  cost from `last_purchase_rate`), overhead line editor (defaults to
  each overhead's `default_amount_per_unit`, flags when customised),
  a live RM+overhead cost-per-unit preview, version notes, and a
  "save as draft" vs "save & activate" toggle (activating archives
  the prior active version, same as the web app).

Rendering note: unlike Receipts/Payables/etc below, BOM's editor is
rendered *in place of* `BomScreen`'s list (a local `editorFgId` state
flip), not as a `Modal` like `MasterCrudScreen` uses — it's too tall
a form for a sheet-style modal to feel right, so it gets its own
scrollable screen with a back chevron instead. `AppNavigator` and
`navConfig.ts` both point `Bom` at `BomScreen` now
(`implemented: true`). `api.ts` picked up the full BOM section
(types + `listBom`/`bomVersionsForFg`/`bomActiveForFg`/
`getBomVersion`/`createBom`/`activateBom`/`archiveBom`).

Not yet wired: `activateBom`/`archiveBom` exist on `api` but have no
UI trigger — the web app doesn't expose them as direct user actions
outside the create-new-version flow either (a version's `status` is
otherwise managed by `createBom`'s `activate_now` flag), so this
matches parity. Add a manual activate/archive action later only if a
real need for it shows up.

## Phase 2b — still not built, here's why

The remaining transactional pages — **Receipts** (1100 lines on the
web), **Payables**, **Production**, **Sales**,
**Salaries/SalaryDetail** — are a different category of work from
everything shipped so far. They involve multi-line item entry,
running balances, payment allocation across multiple receipts, and
calculated totals (GST, stock consumption, payroll). None of them fit
`MasterCrudScreen`, and each needs its own bespoke screen roughly on
the order of what BOM/BomEdit just took, or larger.

Splitting this out rather than rushing a shallow version of each
matches how Job Work and Overheads were scoped down in Phase 1 — it's
better to hand you a clear boundary than a set of screens that look
done but don't handle the actual business logic (stock reversal on
receipt edit, partial payment tracking, BOM-driven consumption on a
production run, etc.) correctly.

Suggested order for what's left, easiest-to-hardest:
1. **Production** — consumes BOM + raw material stock, single-form entry
2. **Other Expenses'-shaped Sales** — invoice with line items + GST calc
3. **Receipts** — supplier receipt + payment status
4. **Payables** — running balance across receipts, partial payments
5. **Salaries / SalaryDetail** — monthly payroll calc, nested list→detail

## Once Phase 2b is fully done

Phase 3 (GST Report, P&L, Cash Flow, Receivables, Payables report
view, Audit Trail) needs a `<ReportTable>` primitive decided once and
reused everywhere — see the migration plan for the card-per-row vs.
horizontally-scrollable-grid tradeoff. Do a throwaway spike on GST
Report specifically before committing, since it's the widest report.
Phase 4 (RoleGate route guards, LanguageToggle/HeaderSearch ports,
offline/loading/error sweep, EAS Android build) is last and doesn't
depend on Phase 3 — it could in principle start in parallel once
Phase 2b is done, if you want to get an installable build in testers'
hands before the reports are finished.
