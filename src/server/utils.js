export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export function centsFromInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
}

export function formatMoney(cents) {
  return Number(cents || 0) / 100;
}

export function canManageRole(actorRole, targetRole) {
  if (actorRole === "owner") return roles.includes(targetRole);
  if (actorRole === "manager") return targetRole === "member";
  return false;
}

export function cleanAccount(account) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    active: Boolean(account.active)
  };
}

export function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0" || value === "") return false;
  return fallback;
}

export function dateRangeFromQuery(query) {
  const from = String(query.from || "").trim();
  const to = String(query.to || "").trim();
  return {
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null,
    to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null
  };
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function sendCsv(res, filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`${csv}\n`);
}

export function normalizeSupabaseError(error) {
  if (!error) return null;
  if (error.code === "23505") return "That record already exists.";
  if (error.code === "42P01") {
    return "Supabase tables are missing. Run npx prisma migrate dev --name init_bookkeeper first.";
  }
  return error.message || "Supabase request failed.";
}
