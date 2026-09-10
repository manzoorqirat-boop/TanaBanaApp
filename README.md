# TanaBana Mobile — all four phases complete, plus a post-launch audit pass

React Native/Expo port of QMfg-Frontend. **Phase 0** (auth, navigation
shell, theme tokens, reusable primitives); **Phase 1** — 10 simple
CRUD/report pages; **Phase 2a** — Raw Materials, Finished Products,
Reorder, Other Expenses; **Phase 2b** — BOM/BomEdit, Production,
Receipts, Payables, Sales, Salaries/SalaryDetail; **Phase 3** — GST
Report, P&L, Cash Flow, Payment Follow-up (Receivables), Audit Trail;
**Phase 4** — RoleGate navigation guard, offline banner, app
icon/splash assets; and an **audit pass** — a full page-by-page,
method-by-method, type-by-type diff against the web app, done in three
rounds. The first found and fixed a real permissions bug, two missing
screens (Dashboard, Settings), and a missing Supplier Ledger view; the
second built out Job Work's entire "Activity" tab (dispatch/receive/
balances/payables/account drill-down), previously just a master list;
the third corrected an overstated i18n-gap claim from the first round
(see "i18n coverage" below — it was 2 screens, not ~30) and added
Urdu, which the web app doesn't have at all. The whole project
type-checks with zero errors and zero unused locals/params
(`npx tsc --noEmit` and `--noUnusedLocals --noUnusedParameters` both
exit clean).

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
  i18n/                        react-i18next; en/hi locales copied as-is
                                 from web, ur.json added (RN-only — the
                                 web app doesn't have Urdu); index.ts
                                 also owns RTL wiring — see "Urdu / RTL
                                 support" below
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
                                 LanguageToggle (now a 3-way en/hi/ur
                                 picker — see "Urdu / RTL support"
                                 below), GstRatePicker (Phase 2b —
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
                                 driving 6 of the 10 Phase 1 pages
                                 (+ Equipment Master, with readOnly)
      FieldForm.tsx              renders a form from a FieldConfig[]
      types.ts                   FieldConfig type
  screens/
    auth/                      Login, ForgotPassword, ResetPassword
    app/
      DashboardScreen.tsx      Audit-pass rebuild — real KPIs (today's
                                 stats, month P&L glance, cost composition,
                                 top performers), not the Phase 0 placeholder
      PlaceholderScreen.tsx    fallback for any screen not yet in
                                 SCREEN_COMPONENTS (none currently used)
      UnitsScreen.tsx          ┐
      MachinesScreen.tsx       │
      OperatorsScreen.tsx      │ Phase 1 — all built on MasterCrudScreen,
      CustomersScreen.tsx      │ ~30-60 lines each (field config + api calls)
      EquipmentMasterScreen.tsx│ (Equipment Master adds readOnly for
      OverheadsScreen.tsx      ┘  non-superadmin — see "Audit pass" below)
      SuppliersScreen.tsx      Audit-pass rebuild — bespoke (was
                                 MasterCrudScreen) for the per-supplier
                                 Ledger view; see "Audit pass" below
      JobWorkScreen.tsx        Audit-pass rebuild — bespoke (was
                                 MasterCrudScreen, master list only);
                                 now the full Activity tab too — dispatch,
                                 receive, balances, payables, account
                                 drill-down; see "Audit pass" below
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
      SettingsScreen.tsx       Audit-pass addition — negative-stock
                                 policy + FG restock thresholds; was
                                 entirely missing, API layer already existed
```

## Audit pass — a full diff against the web app

Everything above was tracked against the migration plan. This pass
instead diffed the two codebases directly: every page in
`QMfg-Frontend/src/pages/` against every RN screen, every exported
method and type in both `api.ts` files (`comm -23` on sorted method/
type-name lists — not a skim), every i18n key, and every `user.role`
conditional in the web app's JSX. Findings, in the order they were
fixed:

- **Equipment Master — a real bug, not just a gap.** The web app
  restricts create/edit/delete to `superadmin`; everyone else gets a
  read-only view with an explicit "maintained centrally, read-only"
  subtitle. `EquipmentMasterScreen` never had that check, so any
  logged-in user could edit a catalog that's shared across every
  tenant. Fixed two ways: `MasterCrudScreen` gained a `readOnly?:
  boolean` prop (collapses `createFn`/`updateFn`/`deactivateFn` to
  `undefined` internally, so every existing conditional in the
  component — the create button, row-tap-to-edit, the delete button —
  disables itself for free, no new render branches), and
  `EquipmentMasterScreen` now passes `readOnly={user?.role !==
  'superadmin'}`. Bulk CSV upload (`bulkUploadEquipment`, also
  superadmin-only on web) wasn't ported — low-traffic admin tool for a
  handful of accounts, not worth the `papaparse`-on-mobile plumbing
  for who'd use it.
- **Dashboard was a placeholder.** The Phase 0 version was a minimal
  "welcome card" by design, but `api.getDashboard()` and the
  `DashboardData` type didn't exist anywhere in this file — a real gap
  this audit found, not a known-and-deferred one. Rebuilt to match
  `pages/Dashboard.tsx`: today's stats (units produced, sales, reorder
  alerts, pending salaries — each tile links to the relevant screen),
  this month's P&L at a glance (revenue/cost/gross/net with margins),
  a cost-composition breakdown linking to the full P&L, and top
  product/customer.
- **Settings was entirely missing.** Not a stub, not a placeholder —
  the screen and its nav entry didn't exist at all. The API layer was
  already 100% there (`myCompany`/`updateMyCompany`, and `Company`'s
  `negative_stock_policy`/`fg_cover_days`/`fg_history_days` fields),
  so this was purely a missing screen: negative-stock policy (allow-
  with-warning vs. block the run) as a two-option radio choice, plus
  finished-goods restock thresholds (cover days / history window).
  No role restriction on web's `/settings` route, so none here either.
- **Supplier Ledger was missing.** `SuppliersScreen` was rebuilt from
  a `MasterCrudScreen` wrapper to a bespoke screen — not because the
  CRUD form had gaps (it didn't; field parity was already complete)
  but because the web version has a per-row "Ledger" button opening a
  running-balance statement (opening → billed → paid → closing, full
  transaction list), and `MasterCrudScreen`/`ListRow` have no concept
  of a secondary per-row action. Bolting one on for a single screen
  wasn't worth complicating a component 7 other simple CRUD pages
  share. `api.ts` picked up `SupplierLedger`/`SupplierLedgerLine` and
  `supplierLedger()`.
- **Job Work's "Activity" tab — the big one.** Only the Job Worker
  master list (create/edit contract-manufacturer profiles) existed;
  the entire running-account sub-system was missing. `JobWorkScreen.tsx`
  was rebuilt from that plain master-list wrapper into the full ported
  page: two tabs (Activity / Job Workers), a Dispatch RM form
  (multi-line, validates each line against on-hand stock before
  submit), a Receive FG form (multi-line RM consumption with
  consumed/wastage/returned per material, live conversion-charge
  preview), three Activity sub-views (FG Receipts with pay-per-receipt,
  RM Dispatches with reversal, RM-at-CMO stock balances), a payables-
  across-all-CMOs warning banner, and a per-worker Account drill-down
  (RM balance at that CMO + a dispatch/receipt timeline). `api.ts`
  picked up `JwDispatch`/`JwDispatchItem`/`JwReceipt`/`JwReceiptItem`/
  `JwAccount`/`CmoBalance`/`JwPayable` and the full
  `listJwDispatches`/`createJwDispatch`/`reverseJwDispatch`/
  `listJwReceipts`/`createJwReceipt`/`payJwReceipt`/`jwAccount`/
  `jwCmoBalances`/`jwPayables` set — nine methods, none of which
  existed before this pass. This was the single largest addition since
  the original Phase 2b build (Sales/Receipts/Payables/Salaries) —
  comparable in scope to that whole batch combined, not a quick add.

## i18n coverage — a correction, then real parity

An earlier version of this README claimed the web app "calls `t()`
throughout — Dashboard alone has ~30 calls, and even a simple page
like Overheads has 9," and that catching the RN app up would mean
retrofitting ~30 screens — a project comparable to Job Work's Activity
tab. That count was wrong: it came from `grep -c "useTranslation\|t("`,
and the bare `t(` pattern matches almost anything ending in `t`
followed by a parenthesis — `format(`, `sort(`, `count(`, `input(` —
not just real translation calls. Rerun with a precise pattern
(`\bt\(['"]`, actual `t(` calls with a string literal) and the real
picture is very different:

```
45  pages/Payables.tsx
44  pages/Dashboard.tsx
14  pages/Login.tsx
 0  every other page, including components/Layout.tsx (the sidebar)
```

The web app has real i18n coverage on exactly **three** pages —
Login, Dashboard, Payables — and hardcodes English everywhere else,
sidebar included. So the actual parity target was never "30 screens
behind the web app"; it was two screens: Dashboard and Payables. Both
are now retrofitted with real `t()` calls matching the web version's
keys exactly (pluralization via i18next's `_one`/`_other` suffixes,
`t('months', { returnObjects: true })` for month names, the same
`currentLocale()` pattern for date formatting). Login already used
`t()` from Phase 0. Every other screen — including the drawer sidebar
— renders hardcoded English, and that's not a gap, it's parity: the
web app's own sidebar does the same thing.

## Urdu / RTL support

Not a web-app port — the web app only ships English and Hindi. Added
here because it's a natural extension of the existing i18n
infrastructure and directly useful for the app's audience. Two
genuinely different pieces, worth keeping distinct:

**Urdu text — done, complete.** `src/i18n/locales/ur.json` has all 199
keys translated (verified against `en.json` with the same flatten-and-
diff check used for the Hindi file: 199/199, zero missing either
direction), following the same convention Hindi uses — technical/
business terms (GST, BOM, UPI, P&L, ERP) stay in Latin script inside
otherwise-Urdu sentences, matching how `hi.json` handles the same
terms. `LanguageToggle` is now a 3-way picker (English / हिंदी / اردو
— each language's name shown in its own script, the standard
convention for language pickers, not something to translate) instead
of the old binary en/hi toggle.

**RTL layout — infrastructure wired up, not manually verified.** Urdu
is written right-to-left, which is a layout concern, not just a text
concern. `i18n/index.ts` calls `I18nManager.allowRTL(true)` +
`I18nManager.forceRTL(isUrdu)` during app boot (before anything real
has rendered — `App.tsx` shows a spinner during this async
`initI18n()` call), which makes RN mirror flex-based layouts
automatically. Since every screen in this codebase is flex-based, that
covers a lot for free. What it doesn't cover:
- **Switching language at runtime.** RN can't remirror an already-
  mounted tree, so `changeLanguage()` now returns `{ rtlChanged }`,
  and `LanguageToggle` shows a "restart needed" alert when switching
  to or from Urdu changes the RTL requirement. No automatic reload is
  wired up — `expo-updates`' reload API needs EAS Update configured
  and behaves differently in Expo Go than a built app, so a plain
  restart prompt is the honest, dependency-free choice for now.
- **Nothing has been visually verified in RTL.** I can't render an RN
  screen with RTL flip active from here — there's no device or
  simulator in this environment. `I18nManager`'s automatic mirroring
  handles standard flex layouts, but doesn't touch things like
  directionally-meaningful icons (a back chevron should flip; a rupee
  symbol shouldn't) or any spot using explicit `left`/`right` instead
  of `flexDirection`. None of that has been swept for or corrected.
  Test on a real device before shipping Urdu as more than a preview.
- **Text-only right now.** Given the "i18n coverage" correction above,
  Urdu is currently visible on exactly the same three screens as
  Hindi: Login, Dashboard, Payables. Everywhere else still renders
  hardcoded English regardless of language selected — switching to
  Urdu doesn't currently *break* anything on those other screens, it
  just doesn't translate them, same as switching to Hindi wouldn't
  either.

**Confirmed *not* gaps**, so they're not listed as open items anywhere
else in this file: every other Phase 1 page (Units, Machines,
Operators, Overheads, Customers, Raw Materials, Finished Products,
Other Expenses) has full field parity with no hidden features; the
`getCustomer`/`getSupplier`/`getSale`/`getRmReceipt`/
`listSupplierPayments` methods exist in the web app's `api.ts` but
aren't called from any web page either — dead code there too, not a
mobile-specific gap; RoleGate's role lists match the web app's
`RoleGate` usage route for route; and the web app's `Layout.tsx` has
no global search, notifications, or company-switcher beyond what's
already in `DrawerContent.tsx`.

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

- **Job Workers**: the master list (create/edit job worker profiles)
  was the only Phase 1 scope. The web app's "Activity" tab — dispatch/
  receive/balances/payables — was a real gap for a while but is now
  built too; see "Audit pass" above. `JobWorkScreen.tsx` covers both.
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

6 of the 10 Phase 1 pages are ~30-60 line files that just configure
`MasterCrudScreen` with:
- a `FieldConfig[]` describing the form (label, type, options)
- the matching `api.list*`/`create*`/`update*`/`deactivate*` functions
- how to render each row's title/subtitle/badge

(Equipment Master also uses it but adds `readOnly`. Suppliers and Job
Work used to as well but were both rebuilt bespoke during the audit
pass — Suppliers for its Ledger view, Job Work for its entire Activity
tab — see "Audit pass" above for both.)

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
- Dashboard now loads real data — confirm `/api/dashboard` actually
  returns something for a company with sales/production history
  (empty-state companies will just show zero tiles, which is correct,
  not broken).
- Settings: toggle the negative-stock policy, save FG restock
  thresholds, confirm both round-trip through `updateMyCompany`.
- Suppliers: tap the Ledger button on a row with real receipts/
  payments and confirm the running balance matches what Payables
  shows for that supplier.
- Equipment Master: log in as a non-superadmin and confirm the create
  button and row-tap-to-edit are both gone — this was the actual bug
  this audit found, so it's worth specifically re-verifying rather
  than assuming the fix landed correctly.
- Job Work: full cycle end to end — dispatch RM to a worker (confirm
  it's rejected if quantity exceeds on-hand stock), receive FG back
  against that dispatch with a consumed/wastage/returned split,
  confirm the conversion charge preview matches what gets saved, mark
  the receipt paid, and check the worker's Account drill-down shows
  both the dispatch and receipt in its timeline with the RM balance
  at that CMO reflecting the consumption. Also try reversing an
  unconsumed dispatch and confirm the stock warning behavior if you
  reverse one that's already been partly drawn against.
- Language switching: on Login, tap through all three — English,
  हिंदी, اردو. Confirm Urdu text renders correctly (proper Nastaliq/
  Naskh shaping, not boxes or reversed characters — a real font/script
  support check that can't be done from here). Then switch to Urdu,
  confirm the restart alert appears, close and reopen the app, and
  check whether the layout actually mirrored (RTL) — this is the
  single most important manual check left in this whole project, per
  "Urdu / RTL support" above.

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
- **RTL on a real device** — Urdu's text is done; its right-to-left
  layout is only automatic-mirroring-plus-hope until someone actually
  looks at a screen in Urdu on a phone. See "Urdu / RTL support"
  above for exactly what's unverified.