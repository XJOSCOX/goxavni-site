import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, "..", "..");
export const distDir = path.join(rootDir, "dist");
export const port = Number(process.env.PORT || 3000);
export const documentBucket = process.env.SUPABASE_DOCUMENT_BUCKET || "bookkeeper-documents";
export const authCookieName = "goxavni_bookkeeper";
export const sessionMaxAgeMs = 1000 * 60 * 30;
export const roles = ["owner", "manager", "member"];
export const accountTypes = ["asset", "liability", "equity", "revenue", "expense"];
export const transactionTypes = ["income", "expense"];
export const recurrenceUnits = ["day", "week", "month", "year"];
export const reminderPriorities = ["low", "normal", "high", "urgent"];
export const reminderStatuses = ["open", "done"];
export const contactTypes = ["customer", "vendor"];
export const invoiceStatuses = ["draft", "sent", "paid", "overdue", "void"];
export const sessionSecret = process.env.SESSION_SECRET || "local-dev-change-this-secret";
export const hasSupabaseConfig = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const defaultAccounts = [
  ["1000", "Operating Cash", "asset"],
  ["1100", "Accounts Receivable", "asset"],
  ["2000", "Accounts Payable", "liability"],
  ["3000", "Owner Equity", "equity"],
  ["4000", "Sales Revenue", "revenue"],
  ["4100", "Software Revenue", "revenue"],
  ["5000", "Office Supplies", "expense"],
  ["5100", "Contract Labor", "expense"],
  ["5200", "Hosting and Software", "expense"],
  ["5300", "Taxes and Licenses", "expense"]
];
