# QMfg Mobile — Phase 0 + Phase 1

React Native/Expo port of QMfg-Frontend. This delivers **Phase 0**
(auth, navigation shell, theme tokens, reusable primitives) and
**Phase 1** — the 10 simple CRUD/report pages: Units, Machines,
Operators, Suppliers, Customers, Equipment Master, Overheads, Job
Workers, Stock Alerts, and Tenants.

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

## Phase 2b — not built yet, here's why

The remaining transactional pages — **Receipts** (1100 lines on the
web), **Payables**, **Production**, **Sales**, **BOM/BomEdit**,
**Salaries/SalaryDetail** — are a different category of work from
everything shipped so far. They involve multi-line item entry,
running balances, payment allocation across multiple receipts, and
calculated totals (GST, stock consumption, payroll). None of them fit
`MasterCrudScreen`, and each needs its own bespoke screen roughly on
the order of what Tenants required, times six.

Splitting this out rather than rushing a shallow version of each
matches how Job Work and Overheads were scoped down in Phase 1 — it's
better to hand you a clear boundary than a set of screens that look
done but don't handle the actual business logic (stock reversal on
receipt edit, partial payment tracking, BOM-driven consumption on a
production run, etc.) correctly.

Suggested order for Phase 2b, easiest-to-hardest:
1. **BOM / BomEdit** — recipe line items, no payment/balance tracking
2. **Production** — consumes BOM + raw material stock, single-form entry
3. **Other Expenses'-shaped Sales** — invoice with line items + GST calc
4. **Receipts** — supplier receipt + payment status
5. **Payables** — running balance across receipts, partial payments
6. **Salaries / SalaryDetail** — monthly payroll calc, nested list→detail
