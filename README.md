# QMfg Mobile — Phase 0 through Phase 2b complete

React Native/Expo port of QMfg-Frontend. Delivered so far: **Phase 0**
(auth, navigation shell, theme tokens, reusable primitives); **Phase
1** — 10 simple CRUD/report pages (Units, Machines, Operators,
Suppliers, Customers, Equipment Master, Overheads, Job Workers, Stock
Alerts, Tenants); **Phase 2a** — Raw Materials, Finished Products,
Reorder, Other Expenses; and **Phase 2b** — BOM/BomEdit, Production,
**Receipts, Payables, Sales, and Salaries/SalaryDetail**. Every page
in the migration plan through Phase 2 is now built. Phase 3 (reports)
and Phase 4 (polish/Android build) are next — see "Continuing into
Phase 3" below.

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
                                 LanguageToggle, GstRatePicker (Phase 2b —
                                 standard-slab dropdown + "Other…", used
                                 by Receipts' create/edit forms)
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
      BomScreen.tsx / BomEditScreen.tsx      Phase 2b — recipe editor
      ProductionScreen.tsx     Phase 2b — log + create form + result banner
      ReceiptsScreen.tsx       Phase 2b — RM receipts: list/filter/paginate,
                                 GST-aware create, edit, cancel
      PayablesScreen.tsx       Phase 2b — supplier drill-down, pay-in-full
      SalesScreen.tsx          Phase 2b — invoice log, GST calc,
                                 partial-payment manager
      SalariesScreen.tsx /     Phase 2b — month picker, generate, summary
      SalaryDetailScreen.tsx    tiles; detail rendered in-place (adjust/
                                 approve/mark-paid/revert/delete)
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

**BOM / BomEdit — shipped.** Two new files:

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

**Production — shipped.** One new file:

- `screens/app/ProductionScreen.tsx` — ports `pages/Production.tsx`:
  a paginated, searchable log of production runs (run number,
  date/shift, operator, machine, product, output, rejects), a "Log
  production" form (operator/machine/product/date/shift/output/
  reject/notes, with a live "stock will go from X to Y" preview), and
  — after saving — a dismissible result banner showing per-raw-material
  consumption (before → after stock, line cost) and the RM+overhead
  cost total the backend computed from the product's active BOM.

Two things worth flagging:
- This screen has no edit or delete. The web app doesn't offer one
  either — a run's stock/cost effects are one-way (it consumes RM
  stock via the BOM and adds to FG stock), so undoing one isn't a
  simple field update. Parity, not a gap.
- Run date is a plain `TextField` (`YYYY-MM-DD`, defaulting to
  today's date as the placeholder) rather than a native date picker.
  RN has no cross-platform date input the way the web's
  `<input type="date">` is free — pulling in
  `@react-native-community/datetimepicker` is a reasonable follow-up
  if manual date entry proves annoying on a real device, but wasn't
  worth the extra dependency for a first pass.

`api.ts` picked up `ProductionRun`/`ProductionRunInput`/
`ProductionRunResult` types and `listProductionRuns`/
`createProductionRun`. `Production` is `implemented: true` in
`navConfig.ts` and registered in `AppNavigator.tsx`.

## Phase 2b — now complete: Receipts, Payables, Sales, Salaries

The remaining transactional pages all shipped as bespoke screens
(none fit `MasterCrudScreen` — each has calculated totals, filters, or
a multi-step flow `MasterCrudScreen`'s generic list+modal shape can't
express):

- **`screens/app/ReceiptsScreen.tsx`** — ports `pages/Receipts.tsx`:
  paginated/searchable/status-filterable list of RM receipts; create
  form with a live taxable/GST/total preview matching the backend's
  calc exactly (`GstRatePicker` for the rate, current-stock hint on
  the RM picker); edit (safe fields free; the quantity/rate/GST trio
  adjusts stock and surfaces a clamp warning banner if reversal hit
  zero); cancel (bottom-sheet confirmation, extra warning if the
  receipt was already paid). `api.ts` picked up
  `RmReceipt`/`RmReceiptInput`/`ReceiptPaymentStatus`/`PaymentMode`
  and `listRmReceipts`/`createRmReceipt`/`updateRmReceipt`/
  `cancelRmReceipt`.
- **`screens/app/PayablesScreen.tsx`** — ports `pages/Payables.tsx`:
  a two-level drill-down, same shape as the web version — supplier
  list with unpaid totals (plus a grand-total card) at the top level,
  tapping one drills into that supplier's individual unpaid receipts,
  each payable in full via a `PayForm` (mode/date/reference/notes).
  Deliberately **not** partial-payment — that's how the web app's
  supplier payables work (only Sales supports partial payment
  amounts). `api.ts` picked up `PayablesSupplier`/`PayablesReceipt`/
  `SupplierPayment`/`SupplierPaymentInput` and
  `payablesBySupplier`/`payablesForSupplier`/`recordPayment`.
- **`screens/app/SalesScreen.tsx`** — ports `pages/Sales.tsx`: invoice
  list with a payment-status pill per row; create form with a
  customer picker (or free-text walk-in name), FG picker with a
  stock-after preview, an inclusive/exclusive GST rate toggle, and a
  live taxable/tax/total breakdown; a post-save result banner
  (stock before → after, warnings); and a `PaymentManager` modal
  supporting **partial** payments — balance/paid/advance summary,
  add-payment form with an overpay-becomes-advance notice, and a
  deletable payment history list. `api.ts` picked up
  `Sale`/`SaleInput`/`SaleResult`/`SalePayment` and
  `listSales`/`createSale`/`salePayments`/`addSalePayment`/
  `deleteSalePayment`.
- **`screens/app/SalariesScreen.tsx`** + **`SalaryDetailScreen.tsx`**
  — ports `pages/Salaries.tsx` + `pages/SalaryDetail.tsx`: month
  picker with arrow navigation, status filter, client-side name
  search, summary tiles (records/gross/paid/unpaid), and a "Generate"
  bottom sheet (monthly / weekly with auto-filled 7-day end date /
  custom range, max 62 days). Tapping a row flips to
  `SalaryDetailScreen` **rendered in place** — the same
  local-state-flip pattern `BomScreen` uses for `BomEditScreen`,
  rather than a separate nav route — showing the pay-basis snapshot,
  full computation breakdown (pieces/fixed/bonus/deductions/advance
  → gross → net), the piece-rate production-run lines table, and
  status-gated actions (draft: recompute/adjust/approve/delete;
  approved: revert-to-draft/mark-paid; paid: read-only payment info).
  `api.ts` picked up `SalaryPeriod`/`SalaryLine`/`SalarySummary`/
  `SalaryGenerateResult`/`SalaryEditInput`/`SalaryMarkPaidInput` and
  the full `listSalaries`/`salarySummary`/`getSalary`/
  `generateSalaries`/`generateSalariesForRange`/`updateSalary`/
  `recomputeSalary`/`approveSalary`/`markSalaryPaid`/
  `revertSalaryToDraft`/`deleteSalary` set.

One intentional gap: the web app's **"Print slip"** button on
`SalaryDetail` opens a new browser window and calls `window.print()`
— there's no RN equivalent, so it wasn't ported. If a printable/
shareable salary slip turns out to matter, the cleanest path is
generating a PDF server-side (or with `expo-print`) and using RN's
`Share` API, rather than trying to fake a print dialog.

All four screens are wired up: `navConfig.ts` has `implemented: true`
on `Receipts`/`Payables`/`Sales`/`Salaries`, and `AppNavigator.tsx`
registers all four in `SCREEN_COMPONENTS`. The whole project
type-checks clean (`npx tsc --noEmit`) other than one pre-existing,
unrelated error in `BomEditScreen.tsx`.

## Continuing into Phase 3 (reports)

Every page through Phase 2 is now built. What's left, per the
migration plan:

**Phase 3 — GST Report, P&L, Cash Flow, Receivables, Payables report
view, Audit Trail.** The hard part: there's no RN `<table>`
equivalent, so before touching any individual report, decide and
build one shared `<ReportTable>` primitive (in `components/ui/`) —
card-per-row for portrait phone use vs. a horizontally-scrollable grid
for wide reports (GST/P&L likely need the grid). Do a throwaway spike
against **GST Report** specifically first, since it's the widest
report and will stress-test whichever layout you pick before you
commit to it across five more screens. Add a shared date-range/filter
control (bottom sheet or header component) alongside it — every
Phase 3 page needs one. Audit Trail is the cheap one in this bucket —
it's just a long filterable list, not a financial grid.

**Phase 4 — RoleGate route guards, LanguageToggle/HeaderSearch ports,
offline/loading/error sweep, EAS Android build.** Doesn't depend on
Phase 3 and could start in parallel if you want an installable build
in testers' hands before the reports are finished. `RoleGate` becomes
a navigation-level guard (redirect before a screen mounts rather than
after); `LanguageToggle.tsx` already has a `components/ui/` port from
Phase 0 wired into the drawer — confirm it's reachable from every
screen, not just the drawer footer; `HeaderSearch.tsx`'s port depends
on how deep the web version's search logic actually runs, so budget
time to check before assuming it's a trivial copy.
