# QMfg Mobile — Phase 0 through Phase 3 complete

React Native/Expo port of QMfg-Frontend. Delivered so far: **Phase 0**
(auth, navigation shell, theme tokens, reusable primitives); **Phase
1** — 10 simple CRUD/report pages (Units, Machines, Operators,
Suppliers, Customers, Equipment Master, Overheads, Job Workers, Stock
Alerts, Tenants); **Phase 2a** — Raw Materials, Finished Products,
Reorder, Other Expenses; **Phase 2b** — BOM/BomEdit, Production,
Receipts, Payables, Sales, and Salaries/SalaryDetail; and **Phase 3**
— GST Report, P&L, Cash Flow, Payment Follow-up (Receivables), and
Audit Trail. Every page in the migration plan is now built. Only
Phase 4 (RoleGate guards, LanguageToggle/HeaderSearch polish,
offline/loading/error sweep, EAS Android build) remains — see
"Continuing into Phase 4" at the end of this file.

## What's here

```
App.tsx                        entry point: i18n boot, providers, nav
app.config.ts                  Expo config; API URL via EXPO_PUBLIC_API_URL
eas.json                       EAS build profiles (preview/production)
src/
  theme/tokens.ts              ported from index.css :root variables
  lib/
    storage.ts                 SecureStore (tokens) + AsyncStorage (prefs)
    api.ts                     ported request()/auth/companies + every
                                domain endpoint through Phase 3
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
                                 by Receipts' create/edit forms),
                                 ReportTable (Phase 3 — the shared
                                 card-per-row primitive every report
                                 screen below is built on)
    crud/
      MasterCrudScreen.tsx      generic list+search+create/edit screen
                                 driving 8 of the 10 Phase 1 pages
      FieldForm.tsx              renders a form from a FieldConfig[]
      types.ts                   FieldConfig type
  screens/
    auth/                      Login, ForgotPassword, ResetPassword
    app/
      DashboardScreen.tsx      Phase 0's one real authenticated screen
      PlaceholderScreen.tsx    fallback for any screen not yet in
                                 SCREEN_COMPONENTS (none currently used)
      UnitsScreen.tsx          ┐
      MachinesScreen.tsx       │
      OperatorsScreen.tsx      │
      SuppliersScreen.tsx      │ Phase 1 — all built on MasterCrudScreen,
      CustomersScreen.tsx      │ ~30-60 lines each (field config + api calls)
      EquipmentMasterScreen.tsx│
      OverheadsScreen.tsx      │
      JobWorkScreen.tsx        ┘ (master list only — see scoping note below)
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
      GstReportScreen.tsx      Phase 3 — the spike page (see below);
                                 net position, output/input cards,
                                 GSTR-1 JSON export via share sheet
      PnlScreen.tsx            Phase 3 — month/YTD/custom modes,
                                 headline tiles, cost breakdown w/
                                 progress bars, by-product/by-customer/
                                 by-expense ReportTables
      CashFlowScreen.tsx       Phase 3 — cash-basis in/out breakdown
      ReceivablesScreen.tsx    Phase 3 — "Payment Follow-up" in the
                                 drawer; overdue/due-soon list + a
                                 follow-up log modal per invoice
      AuditTrailScreen.tsx     Phase 3 — searchable append-only log
```

## Phase 3 — GST Report, P&L, Cash Flow, Receivables, Audit Trail

The migration plan called for deciding a shared `<ReportTable>`
primitive once (RN has no `<table>` equivalent) and doing a throwaway
spike on GST Report first, since it's the widest report. That's what
happened — with one finding worth flagging: **every Phase 3 table
turned out to be narrow** (label + 1-3 numeric columns: GST rate/
taxable/tax; product/units/sales/revenue; category/count/total), not
the wide multi-column grid the plan worried about. So the primitive
that shipped, `components/ui/ReportTable.tsx`, is a card-per-row list
— bold label (+ optional sublabel) on the left, one emphasized "hero"
figure on the right, remaining numeric columns as small muted chips
underneath, plus an optional totals footer. No horizontally-scrollable
grid variant was needed or built; if a genuinely wide report shows up
later, that's a deliberately separate primitive rather than bolted
onto this one.

- **`GstReportScreen.tsx`** — ports `pages/GstReport.tsx`: date-range
  picker, a GSTR-1 JSON export card, the net-GST-position headline
  (colored left border, inverted-duty note), output-vs-input GST
  breakdown cards, and an output-by-rate `ReportTable`. The GSTR-1
  export is the one place Phase 3 needed new capability beyond
  ReportTable: the web version triggers a browser Blob-download; RN
  has no equivalent, so `api.downloadGstr1()` now returns the parsed
  JSON payload instead of triggering a DOM download, and the screen
  writes it to `FileSystem.cacheDirectory` and opens the native share
  sheet via `expo-sharing`. Two new dependencies were added to
  `package.json` for this: `expo-file-system` and `expo-sharing`
  (both at the SDK 52-compatible versions already used elsewhere in
  this project).
- **`PnlScreen.tsx`** — ports `pages/Pnl.tsx`: month/YTD/custom period
  modes (with the month/year arrow-navigators the web version has),
  headline tiles (revenue/cost/gross/net profit with margin %), a cost
  breakdown with proportional progress bars, an activity stats grid,
  a no-revenue warning, and three `ReportTable`s (by product, by
  customer, other-expense breakdown).
- **`CashFlowScreen.tsx`** — ports `pages/CashFlow.tsx`: date-range
  picker, net cash movement headline, and Cash In / Cash Out cards
  each rendered as a `ReportTable` with a totals footer.
- **`ReceivablesScreen.tsx`** — ports `pages/Receivables.tsx` (nav
  label "Payment Follow-up"): summary tiles (outstanding/overdue),
  an overdue/due-soon/all filter, and a list of unpaid sales — rows
  stayed bespoke rather than `ReportTable` since each needs an overdue
  badge and a follow-up action button, not just a label+figure. Each
  row opens a follow-up modal (method/note/promised-date form +
  history list), backed by the same `receivablesList`/
  `receivablesSummary`/`followUpLogs`/`addFollowUp` endpoints as web.
- **`AuditTrailScreen.tsx`** — ports `pages/AuditTrail.tsx`: the cheap
  one per the plan, just a searchable append-only list (when/user/
  action/entity/details), no `ReportTable` needed.

`api.ts` picked up `GstSummary`, `CashFlowReport`, `PnlSummary`/
`PnlProductRow`/`PnlCustomerRow`/`PnlExpenseRow`/`PnlPeriodMode`/
`PnlPeriodParams`, `ReceivableItem`/`ReceivablesSummary`/
`FollowUpLog`, and `AuditLog` types, plus `gstSummary`/`downloadGstr1`/
`cashFlow`/`pnlSummary`/`pnlByProduct`/`pnlByCustomer`/
`pnlExpenseBreakdown`/`receivablesSummary`/`receivablesList`/
`followUpLogs`/`addFollowUp`/`listAuditLogs`.

All five screens are wired up: `navConfig.ts` has `implemented: true`
on `GstReport`/`Pnl`/`CashFlow`/`Receivables`/`AuditTrail`, and
`AppNavigator.tsx` registers all five in `SCREEN_COMPONENTS`.

## Phase 2b — BOM, Production, Receipts, Payables, Sales, Salaries

**BOM / BomEdit.** Two files:

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

Rendering note: BOM's editor is rendered *in place of* `BomScreen`'s
list (a local `editorFgId` state flip), not as a `Modal` like
`MasterCrudScreen` uses — it's too tall a form for a sheet-style modal
to feel right, so it gets its own scrollable screen with a back
chevron instead. `SalariesScreen`/`SalaryDetailScreen` reuse the same
pattern below. `api.ts` picked up the full BOM section (types +
`listBom`/`bomVersionsForFg`/`bomActiveForFg`/`getBomVersion`/
`createBom`/`activateBom`/`archiveBom`).

Not yet wired: `activateBom`/`archiveBom` exist on `api` but have no
UI trigger — the web app doesn't expose them as direct user actions
outside the create-new-version flow either (a version's `status` is
otherwise managed by `createBom`'s `activate_now` flag), so this
matches parity. Add a manual activate/archive action later only if a
real need for it shows up.

**Production.** One file:

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
  worth the extra dependency for a first pass. The same plain-text
  date approach is used everywhere else a date is entered (Receipts,
  Sales, Salaries, and all of Phase 3's date-range pickers), for
  consistency.

`api.ts` picked up `ProductionRun`/`ProductionRunInput`/
`ProductionRunResult` types and `listProductionRuns`/
`createProductionRun`.

**Receipts, Payables, Sales, Salaries.** None of these fit
`MasterCrudScreen` — each has calculated totals, filters, or a
multi-step flow the generic list+modal shape can't express:

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
  local-state-flip pattern `BomScreen` uses for `BomEditScreen` —
  showing the pay-basis snapshot, full computation breakdown
  (pieces/fixed/bonus/deductions/advance → gross → net), the
  piece-rate production-run lines table, and status-gated actions
  (draft: recompute/adjust/approve/delete; approved: revert-to-draft/
  mark-paid; paid: read-only payment info). `api.ts` picked up
  `SalaryPeriod`/`SalaryLine`/`SalarySummary`/`SalaryGenerateResult`/
  `SalaryEditInput`/`SalaryMarkPaidInput` and the full
  `listSalaries`/`salarySummary`/`getSalary`/`generateSalaries`/
  `generateSalariesForRange`/`updateSalary`/`recomputeSalary`/
  `approveSalary`/`markSalaryPaid`/`revertSalaryToDraft`/
  `deleteSalary` set.

One intentional gap: the web app's **"Print slip"** button on
`SalaryDetail` opens a new browser window and calls `window.print()`
— there's no RN equivalent, so it wasn't ported. If a printable/
shareable salary slip turns out to matter, the cleanest path is
generating a PDF server-side (or with `expo-print`) and using RN's
`Share` API, rather than trying to fake a print dialog.

All six Phase 2b screens are wired up: `navConfig.ts` has
`implemented: true` on `Bom`/`Production`/`Receipts`/`Payables`/
`Sales`/`Salaries`, and `AppNavigator.tsx` registers all six in
`SCREEN_COMPONENTS`.

## Phase 2a

Added 4 pages: **Raw Materials**, **Finished Products** (both on
`MasterCrudScreen`, with a live Units-fed dropdown instead of free
text for the unit field), **Reorder** (bespoke — dashboard variant of
Stock Alerts' RM tab, adds a summary card), and **Other Expenses**
(`MasterCrudScreen`, but a transaction log rather than master data —
no Active toggle, a real "Delete expense" button instead, via a new
`deactivateFn`-powered delete action added to `MasterCrudScreen`
itself, so all earlier Phase 1 screens picked up a working
deactivate/delete button too).

## Phase 1 scoping notes (read before building against these)

- **Job Workers**: only the master list (create/edit job worker
  profiles) is built. The web app's "Activity" tab on the same page —
  dispatching raw material to a job worker, recording finished-goods
  receipts back, running balances/payables — is a transactional
  workflow with its own state machine, distinct from the master-data
  list here. There's no current plan to port it; it wasn't in the
  original migration plan's page list.
- **Overheads**: every overhead created here is "General" (`fg_id:
  null`). The web app also supports linking one overhead to a specific
  Finished Product — that selector needs the Finished Products list
  (now shipped in Phase 2a). Add an `fg_id` select field to
  `OverheadsScreen.tsx` if per-product overhead linking turns out to
  matter.
- **Stock Alerts** and **Tenants** don't use `MasterCrudScreen` — the
  former is read-only (no create/edit at all), the latter's edit flow
  uses a company-impersonation trick (`x-company-id` header swap) that
  doesn't fit the generic id-based update pattern.

## The MasterCrudScreen pattern

8 of the 10 Phase 1 pages are ~30-60 line files that just configure
`MasterCrudScreen` with:
- a `FieldConfig[]` describing the form (label, type, options)
- the matching `api.list*`/`create*`/`update*`/`deactivate*` functions
- how to render each row's title/subtitle/badge

Raw Materials and Finished Products (Phase 2a) also fit this shape,
with an extra field or two. Everything from Production onward
(calculated totals, multi-step flows, filters) needed a bespoke
screen instead — see the Phase 2b and Phase 3 sections above for what
each one does differently and why.

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
- Every item in the drawer opens a real screen now — nothing should
  fall through to `PlaceholderScreen`. If something does, it means a
  `navConfig.ts` entry got added without a matching `AppNavigator.tsx`
  registration; check `SCREEN_COMPONENTS`.
- Tenants: create flow (company + owner), and editing an existing
  tenant — confirm the active-company header gets restored afterward
  (check that a subsequent screen still shows your own data, not the
  tenant's).
- Stock Alerts: both tabs load; badges color-code by urgency.
- GST Report's GSTR-1 export: test the share sheet on a real device,
  not just Expo Go in a simulator — `expo-sharing`'s behavior can
  differ there.
- Salaries → tap a row → confirm `SalaryDetailScreen` renders in place
  (no navigation flicker) and the back chevron returns to a refreshed
  list, same check for BOM's editor.

## Continuing into Phase 4 (last phase)

Everything in the migration plan's page list is now built. What's
left is polish, not new pages:

- **RoleGate route guards** — port as a navigation-level guard that
  redirects unauthenticated/unauthorized users before a screen mounts,
  rather than after (the web version's after-the-fact redirect doesn't
  translate directly to RN navigation).
- **LanguageToggle** already has a Phase 0 port in `components/ui/`
  wired into the drawer — confirm it's reachable from screens that
  aren't the drawer footer, not just check it exists.
- **HeaderSearch** — the web version's search logic depth needs
  checking before assuming this is a trivial copy; budget real time
  for it.
- **Offline/loading/error sweep** — every screen already has its own
  loading/error state (established pattern throughout), but a
  deliberate pass across all of them for offline behavior (no network,
  slow network, stale cached lists) hasn't happened yet.
- **App icon, splash screen, `app.json`/`eas.json` config**, then an
  **EAS build → internal testing track → sign for Play Store**.

The practical next step is the polish sweep above, then a real EAS
build on a device to catch anything that only shows up outside Expo
Go (the GSTR-1 share-sheet flow in particular is worth testing on a
real device, since sharing behavior can differ from the simulator).