import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogOut } from "lucide-react";
import "../../styles.css";
import "./bookkeeper.css";
import { api, payload } from "./api.js";
import { Auth } from "./Auth.jsx";
import { Home } from "./Home.jsx";
import { Accounts } from "./views/Accounts.jsx";
import { Dashboard } from "./views/Dashboard.jsx";
import { Members } from "./views/Members.jsx";
import { Payments } from "./views/Payments.jsx";
import { Reports } from "./views/Reports.jsx";
import { Subscriptions } from "./views/Subscriptions.jsx";
import { Timesheets } from "./views/Timesheets.jsx";
import { Transactions } from "./views/Transactions.jsx";
import { Users } from "./views/Users.jsx";

const warningMs = 20 * 60 * 1000;
const timeoutMs = 30 * 60 * 1000;

function Bookkeeper() {
  const [user, setUser] = useState(null);
  const [provider, setProvider] = useState("supabase");
  const [view, setView] = useState("dashboard");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [data, setData] = useState({
    accounts: [],
    transactions: [],
    summary: { income: 0, expenses: 0, net: 0, transactionCount: 0 },
    categories: [],
    members: [],
    timesheets: [],
    payments: [],
    subscriptions: [],
    users: [],
    report: { income: 0, expenses: 0, net: 0, categories: [] }
  });

  const canOwn = user?.role === "owner";
  const canManage = ["owner", "manager"].includes(user?.role);
  const activeMembers = data.members.filter((member) => member.active);
  const assetAccounts = data.accounts.filter((account) => account.active && account.type === "asset");
  const revenueAccounts = data.accounts.filter((account) => account.active && account.type === "revenue");
  const expenseAccounts = data.accounts.filter((account) => account.active && account.type === "expense");
  const roleOptions = useMemo(
    () => (user?.role === "manager" ? [["member", "Member"]] : [["owner", "Owner"], ["manager", "Manager"], ["member", "Member"]]),
    [user?.role]
  );

  function flash(text) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function loadCore(currentUser = user) {
    const [accounts, transactions, summary, members, timesheets] = await Promise.all([
      api("/api/accounts"),
      api("/api/transactions"),
      api("/api/summary"),
      api("/api/members"),
      api("/api/timesheets")
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
      users: [],
      report: { income: 0, expenses: 0, net: 0, categories: [] }
    };
    if (["owner", "manager"].includes(currentUser?.role)) {
      const [users, payments, subscriptions, report] = await Promise.all([
        api("/api/users"),
        api("/api/member-payments"),
        api("/api/subscriptions"),
        api("/api/reports/profit-loss")
      ]);
      next.users = users.users;
      next.payments = payments.payments;
      next.subscriptions = subscriptions.subscriptions;
      next.report = report.report;
    }
    setData(next);
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
    await api(endpoint, {
      method: "POST",
      body: JSON.stringify(payload(form))
    });
    form.reset();
    await loadCore();
    flash(success);
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
    await api(endpoint, {
      method: "PATCH",
      body: JSON.stringify(editing.values)
    });
    setEditing(null);
    await loadCore();
    flash(success);
  }

  useEffect(() => {
    api("/api/me")
      .then((result) => {
        setUser(result.user);
        setProvider(result.provider || "supabase");
        if (result.user) loadCore(result.user).catch((error) => setMessage(error.message));
      })
      .catch(() => setUser(null));
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
    return <Auth systemMessage={message} onAuth={(nextUser, nextProvider) => { setMessage(""); setUser(nextUser); setProvider(nextProvider); loadCore(nextUser).catch((error) => setMessage(error.message)); }} />;
  }

  const editTools = { editing, isEditing, setEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, setMessage };
  const navItems = [
    ["dashboard", "Dashboard", true],
    ["transactions", "Transactions", true],
    ["members", "Members", true],
    ["timesheets", "Timesheets", true],
    ["payments", "Payments", canManage],
    ["subscriptions", "Subscriptions", canManage],
    ["reports", "Reports", canManage],
    ["accounts", "Accounts", true],
    ["users", "Users", canManage]
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
            <span>{user.name} - {user.role}</span>
            <button className="ghost" type="button" onClick={() => logout()}><LogOut size={16} /> Sign out</button>
          </div>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}
        {message && <div className="notice error" role="alert">{message}</div>}

        {view === "dashboard" && <Dashboard data={data} setView={setView} />}
        {view === "transactions" && <Transactions data={data} canManage={canManage} assetAccounts={assetAccounts} revenueAccounts={revenueAccounts} expenseAccounts={expenseAccounts} {...editTools} />}
        {view === "members" && <Members data={data} canManage={canManage} {...editTools} />}
        {view === "timesheets" && <Timesheets data={data} activeMembers={activeMembers} canManage={canManage} {...editTools} />}
        {view === "payments" && <Payments data={data} activeMembers={activeMembers} assetAccounts={assetAccounts} expenseAccounts={expenseAccounts} canOwn={canOwn} {...editTools} />}
        {view === "subscriptions" && <Subscriptions data={data} assetAccounts={assetAccounts} expenseAccounts={expenseAccounts} {...editTools} />}
        {view === "reports" && <Reports data={data} setData={setData} />}
        {view === "accounts" && <Accounts data={data} canOwn={canOwn} {...editTools} />}
        {view === "users" && <Users user={user} data={data} roleOptions={roleOptions} {...editTools} />}

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

createRoot(document.getElementById("root")).render(<App />);
