# goxavni-site

Moving toward the infinite future.

## Bookkeeper

This repo includes a private GoXAvni bookkeeping app at `/bookkeeper`.
The frontend is React with JavaScript, and the server uses Supabase Auth,
Supabase Postgres, and Prisma migrations.

```bash
npm install
npm run dev
```

If port 3000 is busy:

```bash
$env:PORT=3001; npm run dev
```

Open `http://localhost:3001/bookkeeper`.

Fill in `.env` before using the app. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET`.

The sign-up page uses role-specific codes from `.env`:

- `OWNER_SIGNUP_CODE`
- `MANAGER_SIGNUP_CODE`
- `MEMBER_SIGNUP_CODE`

Use long random private codes. Each code can be used once. The code determines
the user's role automatically.

## Supabase setup

1. Create a Supabase project.
2. Copy your project URL, anon key, service role key, and Postgres connection strings into `.env`.
3. Set a strong `SESSION_SECRET` and private role signup codes.
4. Update `prisma/schema.prisma` for database changes.
5. Run `npx prisma migrate dev --name update_name`.
6. Restart `npm run dev`.

Never put the service role key in browser code. This app only reads it on the server.

For Prisma, use Supabase Postgres connection strings:

- `DATABASE_URL`: app/runtime connection string.
- `DIRECT_URL`: migration connection string used by Prisma CLI.

## Stack

- React
- JavaScript
- Vite
- Express
- Supabase Auth
- Supabase Postgres
- Prisma
- Vercel deployment

## Roles

- `owner`: full access, including users and chart of accounts.
- `manager`: can manage members, approve timesheets, view reports, and create member users.
- `member`: can enter transactions and timesheets.

Member users only see their own linked member profile, timesheets, reminders,
calendar items, and transaction summary. Owners can review write activity in the
Audit section.

## Operations

- Readiness check: `/api/health/ready`
- Basic health check: `/api/health`
- Login and sign-up have basic rate limiting.
- Important create/update/approval actions are written to `audit_logs`.
- Customers and vendors are tracked in Contacts.
- Invoices can be created, exported, and marked paid. Marking paid creates the matching income transaction.
- Document links can be attached to records for receipts, contracts, and supporting files.
- Active subscriptions can be posted into expense transactions and advanced to the next due date.

## Deployment note

The public landing page and bookkeeper route can run on Vercel. Bookkeeping
data is stored in Supabase.
