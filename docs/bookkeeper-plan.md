# GoXAvni Bookkeeper Plan

GoXAvni is the parent company. The bookkeeper is a private operational tool
under that parent, backed by Supabase Auth, Supabase Postgres, and Prisma.

## Current Scope

- Supabase Auth and Postgres
- Sign-up protected by one-time role codes from `.env`
- Session login with secure HTTP-only cookies
- Roles: `owner`, `manager`, `member`
- Owner can create users
- Manager can create and view members
- Owner can create accounts
- Owner, manager, and member can create transactions
- Members, timesheets, member payments, reports, and CSV downloads
- Chart of accounts seeded for a small software/app company
- Income and expense transaction capture
- Dashboard totals for income, expenses, net, transaction count, and top categories

## Data

Supabase is the source of truth for users, roles, accounts, transactions, and one-time signup code usage.

Recommended habits:

- Set `SESSION_SECRET` in the environment before everyday use.
- Use separate 64-character or longer `OWNER_SIGNUP_CODE`, `MANAGER_SIGNUP_CODE`, and `MEMBER_SIGNUP_CODE` values.

## Vercel

Vercel can host the public site and bookkeeper routes. Supabase stores the persistent data.

1. Add Supabase env vars and Postgres connection strings in `.env` locally and in Vercel project settings.
2. Change tables through `prisma/schema.prisma`.
3. Run `npx prisma migrate dev --name update_name` locally.
4. Use `npx prisma migrate deploy` for production deployment.
5. Keep the service role key server-side only.
6. Add production password reset, audit logs, exports, and recurring backup jobs.

## Stack

- React and JavaScript
- Vite
- Express
- Supabase Auth and Postgres
- Prisma migrations
- Vercel

## Next Useful Features

- Edit and void transactions
- CSV import
- Receipt attachment storage
- Audit log for user actions
- Password change screen
- Account reconciliation workflow
