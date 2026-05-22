import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogOut } from "lucide-react";
import "../../styles.css";
import "./bookkeeper.css";
import { api, messageForError, money, payload } from "./api.js";
import { Auth } from "./Auth.jsx";
import { ErrorBoundary } from "./components.jsx";
import { Home } from "./Home.jsx";
import { Accounts } from "./views/Accounts.jsx";
import { AuditLogs } from "./views/AuditLogs.jsx";
import { Calendar } from "./views/Calendar.jsx";
import { Contacts } from "./views/Contacts.jsx";
import { Dashboard } from "./views/Dashboard.jsx";
import { Documents } from "./views/Documents.jsx";
import { Invoices } from "./views/Invoices.jsx";
import { Members } from "./views/Members.jsx";
import { Payments } from "./views/Payments.jsx";
import { Products } from "./views/Products.jsx";
import { Reminders } from "./views/Reminders.jsx";
import { Reports } from "./views/Reports.jsx";
import { Smart } from "./views/Smart.jsx";
import { Subscriptions } from "./views/Subscriptions.jsx";
import { Timesheets } from "./views/Timesheets.jsx";
import { Transactions } from "./views/Transactions.jsx";
import { Users } from "./views/Users.jsx";

const warningMs = 20 * 60 * 1000;
const timeoutMs = 30 * 60 * 1000;

function initials(name = "") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "GX";
}

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Bookkeeper() {
  const [user, setUser] = useState(null);
  const [provider, setProvider] = useState("supabase");
  const [view, setView] = useState("dashboard");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [data, setData] = useState({
    accounts: [],
    transactions: [],
    summary: { income: 0, expenses: 0, net: 0, transactionCount: 0 },
    categories: [],
    members: [],
    timesheets: [],
    payments: [],
    subscriptions: [],
    contacts: [],
    invoices: [],
    documents: [],
    products: [],
    productSubscriptions: [],
    inventoryMovements: [],
    auditLogs: [],
    reminders: [],
    calendar: { from: "", to: "", events: [] },
    smart: {
      metrics: {
        overdueReminders: 0,
        dueSoonReminders: 0,
        upcomingSubscriptions: 0,
        pendingTimesheets: 0,
        overdueInvoices: 0,
        activeSubscriptions: 0,
        recurringAmount: 0
      },
      insights: [],
      reminders: [],
      subscriptions: [],
      invoices: [],
      timesheets: []
    },
    users: [],
    report: { income: 0, expenses: 0, net: 0, categories: [] },
    balanceSheet: { assets: [], liabilities: [], equity: [], totals: {} },
    cashFlow: { inflows: 0, outflows: 0, net: 0, rows: [] },
    monthlyCloses: []
  });

  const canOwn = user?.role === "owner";
  const canManage = ["owner", "manager"].includes(user?.role);
  const activeMembers = data.members.filter((member) => member.active);
  const customers = data.contacts.filter((contact) => contact.active && contact.type === "customer");
  const assetAccounts = data.accounts.filter((account) => account.active && account.type === "asset");
  const revenueAccounts = data.accounts.filter((account) => account.active && account.type === "revenue");
  const expenseAccounts = data.accounts.filter((account) => account.active && account.type === "expense");
  const net = Number(data.summary.net || 0);
  const netLabel = net >= 0 ? "Profit" : "Loss";
  const roleOptions = useMemo(
    () => (user?.role === "manager" ? [["member", "Member"]] : [["owner", "Owner"], ["manager", "Manager"], ["member", "Member"]]),
    [user?.role]
  );

  function flash(text) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function loadCore(currentUser = user) {
    setLoading(true);
    setLoadError("");
    try {
      const [accounts, transactions, summary, members, timesheets, reminders, calendar, smart] = await Promise.all([
        api("/api/accounts"),
        api("/api/transactions"),
        api("/api/summary"),
        api("/api/members"),
        api("/api/timesheets"),
        api("/api/reminders"),
        api("/api/calendar"),
        api("/api/smart")
      ]);
      const next = {
        accounts: accounts.accounts,
        transactions: transactions.transactions,
        summary: summary.summary,
        categories: summary.categories,
        members: members.members,
        timesheets: timesheets.timesheets,
        payments: [],
        subscriptions: [],
        contacts: [],
        invoices: [],
        documents: [],
        products: [],
        productSubscriptions: [],
        inventoryMovements: [],
        auditLogs: [],
        reminders: reminders.reminders,
        calendar: calendar.calendar,
        smart: smart.smart,
        users: [],
        report: { income: 0, expenses: 0, net: 0, categories: [] },
        balanceSheet: { assets: [], liabilities: [], equity: [], totals: {} },
        cashFlow: { inflows: 0, outflows: 0, net: 0, rows: [] },
        monthlyCloses: []
      };
      if (["owner", "manager"].includes(currentUser?.role)) {
        const [users, payments, subscriptions, contacts, invoices, documents, products, report, balanceSheet, cashFlow, monthlyCloses] = await Promise.all([
          api("/api/users"),
          api("/api/member-payments"),
          api("/api/subscriptions"),
          api("/api/contacts"),
          api("/api/invoices"),
          api("/api/documents"),
          api("/api/products"),
          api("/api/reports/profit-loss"),
          api("/api/reports/balance-sheet"),
          api("/api/reports/cash-flow"),
          api("/api/monthly-closes")
        ]);
        next.users = users.users;
        next.payments = payments.payments;
        next.subscriptions = subscriptions.subscriptions;
        next.contacts = contacts.contacts;
        next.invoices = invoices.invoices;
        next.documents = documents.documents;
        next.products = products.products;
        next.productSubscriptions = products.productSubscriptions;
        next.inventoryMovements = products.inventoryMovements;
        next.report = report.report;
        next.balanceSheet = balanceSheet.report;
        next.cashFlow = cashFlow.report;
        next.monthlyCloses = monthlyCloses.monthlyCloses;
      }
      if (currentUser?.role === "owner") {
        const auditLogs = await api("/api/audit-logs");
        next.auditLogs = auditLogs.auditLogs;
      }
      setData(next);
    } catch (error) {
      const text = messageForError(error);
      setLoadError(text);
      setMessage(text);
      if (error.status === 401) setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function logout(reason = "") {
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
    } catch {
      // The local cookie may already be gone. Clear the UI either way.
    }
    setUser(null);
    setEditing(null);
    setIdleWarning(false);
    if (reason) setMessage(reason);
  }

  async function submit(endpoint, form, success) {
    setMessage("");
    try {
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify(payload(form))
      });
      form.reset();
      await loadCore();
      flash(success);
    } catch (error) {
      throw new Error(messageForError(error));
    }
  }

  function startEdit(kind, id, values) {
    setMessage("");
    setEditing({ kind, id, values });
  }

  function cancelEdit() {
    setEditing(null);
  }

  function isEditing(kind, id) {
    return editing?.kind === kind && String(editing.id) === String(id);
  }

  function setEditValue(name, value) {
    setEditing((current) => ({ ...current, values: { ...current.values, [name]: value } }));
  }

  async function saveEdit(endpoint, success) {
    setMessage("");
    try {
      await api(endpoint, {
        method: "PATCH",
        body: JSON.stringify(editing.values)
      });
      setEditing(null);
      await loadCore();
      flash(success);
    } catch (error) {
      throw new Error(messageForError(error));
    }
  }

  async function deleteRecord(endpoint, label = "record") {
    setMessage("");
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
    try {
      await api(endpoint, { method: "DELETE" });
      setEditing(null);
      await loadCore();
      flash(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted.`);
    } catch (error) {
      setMessage(messageForError(error));
    }
  }

  useEffect(() => {
    api("/api/me")
      .then((result) => {
        setUser(result.user);
        setProvider(result.provider || "supabase");
        if (result.user) loadCore(result.user).catch(() => {});
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let warningTimer;
    let logoutTimer;
    const resetIdle = () => {
      setIdleWarning(false);
      window.clearTimeout(warningTimer);
      window.clearTimeout(logoutTimer);
      warningTimer = window.setTimeout(() => setIdleWarning(true), warningMs);
      logoutTimer = window.setTimeout(() => logout("Signed out after 30 minutes of inactivity."), timeoutMs);
    };
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdle));
      window.clearTimeout(warningTimer);
      window.clearTimeout(logoutTimer);
    };
  }, [user]);

  if (!user) {
    return <Auth systemMessage={message} onAuth={(nextUser, nextProvider) => { setMessage(""); setUser(nextUser); setProvider(nextProvider); loadCore(nextUser).catch(() => {}); }} />;
  }

  const editTools = { editing, isEditing, setEditing, setEditValue, startEdit, cancelEdit, saveEdit, deleteRecord, submit, setMessage };
  const navItems = [
    ["dashboard", "Dashboard", true],
    ["smart", "Smart", true],
    ["calendar", "Calendar", true],
    ["reminders", "Reminders", true],
    ["transactions", "Transactions", true],
    ["members", "Members", true],
    ["timesheets", "Timesheets", true],
    ["payments", "Payments", canManage],
    ["contacts", "Contacts", canManage],
    ["invoices", "Invoices", canManage],
    ["documents", "Documents", canManage],
    ["products", "Products", canManage],
    ["subscriptions", "Subscriptions", canManage],
    ["reports", "Reports", canManage],
    ["accounts", "Accounts", true],
    ["users", "Users", canManage],
    ["audit", "Audit", canOwn]
  ];

  return (
    <main className="app-view" aria-label="Bookkeeper workspace">
      <aside className="sidebar">
        <a className="brand" href="/">Go<span>X</span>Avni</a>
        <nav className="nav" aria-label="Bookkeeper sections">
          {navItems.filter((item) => item[2]).map(([id, label]) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} type="button" onClick={() => { setView(id); setEditing(null); }}>{label}</button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Supabase ledger</p>
            <h1>{view.charAt(0).toUpperCase() + view.slice(1)}</h1>
          </div>
          <div className="session">
            <div className="user-chip" aria-label="Current user">
              <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
              <span><strong>{user.name}</strong><small>{user.role}</small></span>
            </div>
            <div className="topbar-stat"><span>Time</span><strong>{formatClock(now)}</strong></div>
            <div className="topbar-stat"><span>Revenue</span><strong>{money.format(data.summary.income || 0)}</strong></div>
            <div className={`topbar-stat ${net >= 0 ? "profit-stat" : "loss-stat"}`}><span>{netLabel}</span><strong>{money.format(Math.abs(net))}</strong></div>
            <button className="ghost" type="button" onClick={() => logout()}><LogOut size={16} /> Sign out</button>
          </div>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}
        {message && <div className="notice error" role="alert">{message}</div>}
        {loading && <div className="notice neutral" role="status">Loading latest bookkeeping data...</div>}
        {loadError && (
          <section className="error-panel compact-error" role="alert">
            <h2>Could not load the latest data.</h2>
            <p>{loadError}</p>
            <button type="button" onClick={() => loadCore().catch(() => {})}>Try again</button>
          </section>
        )}

        {view === "dashboard" && <Dashboard data={data} setView={setView} canManage={canManage} />}
        {view === "smart" && <Smart data={data} setData={setData} setMessage={setMessage} />}
        {view === "calendar" && <Calendar data={data} setData={setData} setMessage={setMessage} />}
        {view === "reminders" && <Reminders data={data} {...editTools} />}
        {view === "transactions" && <Transactions data={data} canManage={canManage} assetAccounts={assetAccounts} revenueAccounts={revenueAccounts} expenseAccounts={expenseAccounts} {...editTools} />}
        {view === "members" && <Members data={data} canManage={canManage} {...editTools} />}
        {view === "timesheets" && <Timesheets data={data} activeMembers={activeMembers} canManage={canManage} {...editTools} />}
        {view === "payments" && <Payments data={data} activeMembers={activeMembers} assetAccounts={assetAccounts} expenseAccounts={expenseAccounts} canOwn={canOwn} {...editTools} />}
        {view === "contacts" && <Contacts data={data} {...editTools} />}
        {view === "invoices" && <Invoices data={data} customers={customers} assetAccounts={assetAccounts} revenueAccounts={revenueAccounts} refreshData={loadCore} {...editTools} />}
        {view === "documents" && <Documents data={data} refreshData={loadCore} {...editTools} />}
        {view === "products" && <Products data={data} refreshData={loadCore} {...editTools} />}
        {view === "subscriptions" && <Subscriptions data={data} assetAccounts={assetAccounts} expenseAccounts={expenseAccounts} refreshData={loadCore} {...editTools} />}
        {view === "reports" && <Reports data={data} setData={setData} setMessage={setMessage} refreshData={loadCore} canOwn={canOwn} deleteRecord={deleteRecord} />}
        {view === "accounts" && <Accounts data={data} canOwn={canOwn} {...editTools} />}
        {view === "users" && <Users user={user} data={data} roleOptions={roleOptions} {...editTools} />}
        {view === "audit" && <AuditLogs data={data} />}

        <footer className="bookkeeper-footer">
          <span>GoXAvni LLC Internal Finance Portal</span>
          <span>{provider} auth</span>
        </footer>
      </section>

      {idleWarning && (
        <div className="modal-backdrop" role="presentation">
          <section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="idle-title">
            <h2 id="idle-title">Still working?</h2>
            <p>You have been inactive for 20 minutes. For security, this session will sign out after 30 minutes of inactivity.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setIdleWarning(false)}>Stay signed in</button>
              <button className="ghost" type="button" onClick={() => logout()}>Sign out</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function App() {
  return window.location.pathname.startsWith("/bookkeeper") ? <Bookkeeper /> : <Home />;
}

createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);
