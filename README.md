# TanaBana Mobile — all four phases complete

React Native/Expo port of QMfg-Frontend. **Phase 0** (auth, navigation
shell, theme tokens, reusable primitives); **Phase 1** — 10 simple
CRUD/report pages; **Phase 2a** — Raw Materials, Finished Products,
Reorder, Other Expenses; **Phase 2b** — BOM/BomEdit, Production,
Receipts, Payables, Sales, Salaries/SalaryDetail; **Phase 3** — GST
Report, P&L, Cash Flow, Payment Follow-up (Receivables), Audit Trail;
and **Phase 4** — RoleGate navigation guard, offline banner, app
icon/splash assets, and a couple of scoping corrections (see below).
Every page in the original migration plan is built and wired up. The
whole project type-checks with zero errors and zero unused
locals/params (`npx tsc --noEmit` and `--noUnusedLocals
--noUnusedParameters` both exit clean).

## What's here

```
App.tsx                        entry point: i18n boot, providers, nav
app.config.ts                  Expo config; API URL via EXPO_PUBLIC_API_URL
eas.json                       EAS build profiles (preview/production)
assets/                        icon.png, splash.png, adaptive-icon.png —
                                 Phase 4 placeholders (see "App icon/splash"
                                 below), swap for real branding before shipping
src/
  theme/tokens.ts              ported from index.css :root variables
  lib/
    storage.ts                 SecureStore (tokens) + AsyncStorage (prefs)
    api.ts                     ported request()/auth/companies + every
                                domain endpoint through Phase 3
    useNetworkStatus.ts        Phase 4 — NetInfo-based online/offline hook
  context/AuthContext.tsx      ported, adapted for async storage
  i18n/                        react-i18next, en/hi locales copied as-is
  navigation/
    RootNavigator.tsx          swaps Auth ↔ App navigator on auth state;
                                 renders the Phase 4 OfflineBanner app-wide
    AuthNavigator.tsx          Login, ForgotPassword, ResetPassword
    AppNavigator.tsx           Drawer; registers every NAV screen, each
                                 wrapped in RoleGate per its navConfig roles
    RoleGate.tsx                Phase 4 — navigation-level role guard,
                                 ports App.tsx's RoleGate route wrapper
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
                                 screen below is built on),
                                 HeaderSearch (Phase 4 — shared search
                                 input for new list screens; existing
                                 screens already have this inlined, see
                                 "HeaderSearch" below),
                                 OfflineBanner (Phase 4 — rendered by
                                 RootNavigator, not used directly by screens)
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

## Renamed to TanaBana

The app's display name was originally "QMfg" (matching the source web
app's own branding — see `QMfg-Frontend` throughout this file, which
is that source repo's actual name and stays as-is, since it's a
factual pointer to what's being ported, not this app's brand). It's
now "TanaBana". What changed and what didn't:

**Changed — user-visible, no downside:**
- `app.config.ts`'s `name` field, the brand text on the drawer header
  and all three auth screens (Login/ForgotPassword/ResetPassword), the
  Tenants page's explanatory copy, and the footer copyright string in
  both `en.json` and `hi.json`.
- `package.json`'s `name` field (and the regenerated `package-lock.json`
  to match) — purely a dev-tooling label, zero runtime effect.

**Changed — safe *only* because nothing has shipped yet:**
- `app.config.ts`'s `slug` (`qmfg-mobile` → `tanabana-mobile`) and
  `android.package` (`com.qmsofts.qmfg` → `com.qmsofts.tanabana`). The
  slug ties to whatever Expo/EAS project you've registered; the
  Android package name is **permanent** once a build using it reaches
  the Play Store. Both are safe to change now since — per every prior
  phase's notes in this README — no build has been signed or
  submitted yet. If that's no longer true by the time you read this
  (i.e. you've already run a real `eas build` or published anything),
  revert these two specific fields rather than the rest of this
  change.
- The deep-link scheme in `navigation/linking.ts`
  (`qmfg://` → `tanabana://`, plus the matching `https://` prefix).
  Same caveat: only matters once a build is live, and the backend's
  password-reset email template needs to agree with whichever scheme
  is actually current.
- The SecureStore/AsyncStorage key names in `lib/api.ts`
  (`qmfg_token`/`qmfg_refresh`/`qmfg_active_company` →
  `tanabana_token`/etc.). While making this change, found
  `context/AuthContext.tsx`'s bootstrap check was a **hardcoded
  duplicate of the token-key string** rather than importing the
  constant from `api.ts` — a pre-existing bug risk (not introduced by
  this rename) that would have silently broken login-state restoration
  the moment the two literals drifted, exactly like this rename would
  have. Fixed properly: `TOKEN_KEY` is now exported from `api.ts` and
  `AuthContext.tsx` imports it instead of repeating the literal. The
  practical effect of the key rename itself: anyone with an existing
  dev build gets logged out once on next launch. Harmless with no real
  users yet.

**Deliberately not touched:**
- The `com.qmsofts.*` Android package namespace itself (only the
  trailing segment changed) — `qmsofts` is the company/developer
  namespace, not the app name.
- Every reference to `QMfg-Frontend` — that's the actual name of the
  source web-app repo this was ported from, a fact about where the
  code came from, not this app's own branding.
- The overall placeholder approach (still not final branding — swap
  before a production release) and the accent-blue palette
  (`#1d4ed8`). The mark itself was redesigned though, not just
  relabeled — see the icon/splash note in the Phase 4 section below
  for what it shows now and why.

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
   Railway URL you're using for TanaBana's backend right now.
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

## Phase 4 — RoleGate, offline banner, app icon/splash

Migration-plan Phase 4 was RoleGate guards, LanguageToggle/
HeaderSearch polish, an offline/loading/error sweep, and app icon/
splash/EAS config. Here's what each turned out to need:

- **RoleGate — real gap, now fixed.** The web app wraps individual
  restricted routes (GST Report, Cash Flow, Receivables, Audit Trail,
  Tenants) in a `RoleGate` that shows an explicit "Access denied"
  screen rather than silently failing. The RN port only had
  `DrawerContent`'s `canSee()` filtering restricted items out of the
  *menu* — which stops someone from tapping their way there, but
  doesn't stop `navigation.navigate('Tenants')` from mounting the real
  screen if called from anywhere else (a Dashboard shortcut, a deep
  link, future code that doesn't know about the restriction). Added
  `navigation/RoleGate.tsx` (ports the web version's copy and layout
  exactly) and wired it into `AppNavigator.tsx` via a
  `GATED_SCREEN_COMPONENTS` map built once at module load — every
  screen whose `navConfig.ts` entry has `roles` is now wrapped, so the
  check happens before the real screen mounts, matching the plan's
  "navigation-level guard" framing. Also made `flattenNavScreens()`
  inherit a parent group's `roles` onto children without their own,
  defensively (no group currently sets `roles`, but a child shouldn't
  need to repeat it if one ever does).
- **LanguageToggle — not actually a gap.** The plan's note said to
  "confirm it's reachable from every screen, not just the drawer
  footer" — but checking the *web app itself* shows `LanguageToggle`
  is only ever used on `pages/Login.tsx`, never in the authenticated
  `Layout.tsx` sidebar. The RN port already matches that exactly (only
  used on `LoginScreen.tsx`). No change needed; a Phase 3 README note
  claiming it was "wired into the drawer" was simply wrong and is
  corrected here.
- **HeaderSearch — not actually a gap either.** The web source
  (`components/HeaderSearch.tsx`) is a plain controlled input with an
  Enter-to-submit handler, no hidden logic. Every RN list screen built
  across Phases 2-3 already has this exact behavior inlined via
  `TextField` + `onSubmitEditing` (built before a shared version
  existed). Added `components/ui/HeaderSearch.tsx` for any *new* list
  screen to use, but didn't retrofit the ~10 existing ones — that's a
  pure refactor with zero behavior change, not worth the churn.
- **Offline sweep.** Every screen already has its own loading/error
  state (established pattern since Phase 1) — retrofitting all ~25 of
  them individually for offline-specific messaging wasn't the highest-
  leverage move. Instead added one app-shell-level signal:
  `lib/useNetworkStatus.ts` (a `@react-native-community/netinfo`
  hook) + `components/ui/OfflineBanner.tsx`, rendered by
  `RootNavigator.tsx` above the navigator so it's visible on every
  screen without touching any of them. Screens still show their own
  request-level errors when a call actually fails; the banner just
  explains *why*, proactively, before someone starts tapping around
  with no connection.
- **App icon/splash — found a real build-breaker, then designed a
  real mark.** `app.config.ts` already referenced `./assets/icon.png`,
  `./assets/splash.png`, and `./assets/adaptive-icon.png` (plus an
  adaptive-icon background color and splash background color, both
  already chosen) — but the `assets/` folder didn't exist at all. An
  actual `eas build` would have failed on missing assets. The first
  pass generated a plain white "Q" letterform; that got replaced with
  something more intentional once the app was renamed: "TanaBana"
  (ताना-बाना) literally means *warp and weft* — the two thread sets
  that cross to form woven fabric — which is both a better mark for a
  manufacturing app than a monogram and a literal reading of the name.
  The current assets are a circular 3×3 basket-weave — two-tone bands
  (opaque + translucent) alternating in a checkerboard so alternating
  crossings read as over/under, not a flat grid — rendered at 4×
  supersampling and downsampled for clean anti-aliased edges. Sized
  correctly for each use: 1024×1024 solid accent-blue (`#1d4ed8`)
  background for `icon.png`; 1024×1024 transparent background with
  the mark kept inside Android's ~66% adaptive-icon safe zone for
  `adaptive-icon.png`; a smaller transparent version in accent-blue
  tones for `splash.png` so the config's light splash `backgroundColor`
  shows through cleanly. Still hand-generated placeholders, not a
  professional design pass — swap for real brand assets before a
  production release — but they're now a real, on-brand mark rather
  than a letter, and the build path is no longer broken either way.

Bonus: while doing this pass, also fixed the one pre-existing type
error in `BomEditScreen.tsx` (same array-passed-to-`Card`-style
pattern fixed elsewhere) and two pre-existing unused-variable warnings
in `MasterCrudScreen.tsx`/`DashboardScreen.tsx`. The whole project now
type-checks with zero errors and zero unused locals/params.

## What's left

Everything in the original migration plan — every page, every phase —
is built. What remains is exactly what no amount of code review from
here can substitute for:

- **An actual EAS build on a real device.** Nothing in this repo has
  run outside a TypeScript compiler yet. Push to GitHub, run
  `eas build --platform android --profile preview` (see "Setup"
  above), and install the result on a phone.
- **The GSTR-1 share-sheet flow specifically** — `expo-sharing`'s
  behavior can differ between Expo Go, a simulator, and a real device;
  this is the one Phase 3 feature that reaches outside pure UI code
  (writing a file, invoking the OS share sheet) and is worth
  deliberately testing first.
- **RoleGate, in practice** — log in as a non-owner/non-superadmin
  role and confirm both halves: the drawer hides restricted items
  (already worked before this change) *and* an attempt to reach one
  anyway shows "Access denied" rather than crashing or rendering the
  real screen (the part this change added).
- **Real app icon/splash art** — the placeholders unblock the build
  but aren't final branding.