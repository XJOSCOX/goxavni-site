# GoXAvni Bookkeeper Roadmap

This is the next practical path for making the internal finance portal stronger as the company starts using it for real operations.

## Production Hardening

- Add database-backed audit logs for create, update, approval, payment, and user-role changes.
- Add soft delete or void workflows instead of destructive deletes.
- Add rate limiting for login and sign-up attempts.
- Add database indexes for reporting ranges, calendar ranges, and common ledger filters.
- Add a Vercel deployment checklist with required environment variables and migration steps.

## Bookkeeping Core

- Add account balances and cash-flow views.
- Add vendors, customers, and projects as first-class records instead of free-text fields only.
- Add invoice tracking for revenue: draft, sent, paid, overdue.
- Add receipt/document uploads for expenses and member payments.
- Add transaction review statuses: draft, reviewed, posted, void.
- Add recurring transaction generation from subscriptions.

## Member Operations

- Restrict member users to their own timesheets unless owner or manager.
- Add weekly timesheet submission and approval batches.
- Add payment runs from approved unpaid timesheets.
- Add exportable member statements.

## Reporting

- Add balance sheet, cash-flow report, expense-by-vendor report, and member-payroll report.
- Add CSV exports that honor the selected date filters.
- Add PDF reports for owner-ready monthly close packages.
- Add month close snapshots so prior reports do not shift unexpectedly.

## Smart Features

- Flag unusual expenses, duplicate references, missing receipts, and overdue recurring expenses.
- Forecast upcoming cash needs from subscriptions, payroll, reminders, and open invoices.
- Suggest categories based on vendor and past transaction history.
- Add reminder templates for tax deadlines, LLC filings, payroll, and monthly close.

## UX Improvements

- Add search and filters on every table.
- Add pagination for large ledgers.
- Add confirmation dialogs for high-impact actions.
- Add keyboard-friendly quick entry for transactions and timesheets.
- Add empty states that guide the first setup flow: accounts, members, first transaction, first report.
