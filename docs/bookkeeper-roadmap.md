# GoXAvni Bookkeeper Roadmap

This is the next practical path for making the internal finance portal stronger as the company starts using it for real operations.

## Production Hardening

- Done: add database-backed audit logs for create, update, approval, payment, and user-role changes.
- Add soft delete or void workflows instead of destructive deletes.
- Done: add basic rate limiting for login and sign-up attempts.
- Add database indexes for reporting ranges, calendar ranges, and common ledger filters.
- Add a Vercel deployment checklist with required environment variables and migration steps.

## Bookkeeping Core

- Add account balances and cash-flow views.
- Done: add customers and vendors as first-class Contacts.
- Done: add invoice tracking for revenue: draft, sent, paid, overdue, void.
- Done: add document links for receipts, contracts, and supporting files.
- Add transaction review statuses: draft, reviewed, posted, void.
- Done: add recurring transaction posting from subscriptions.

## Member Operations

- Done: restrict member users to their own linked member data.
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

- Done: add shared table search.
- Done: add shared table pagination.
- Add confirmation dialogs for high-impact actions.
- Add keyboard-friendly quick entry for transactions and timesheets.
- Add empty states that guide the first setup flow: accounts, members, first transaction, first report.
