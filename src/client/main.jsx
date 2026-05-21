import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Download, LogOut, Plus, UserPlus } from "lucide-react";
import "../../styles.css";
import "./bookkeeper.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function payload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function Home() {
  return (
    <main className="site">
      <header className="header">
        <a className="home-brand" href="/" aria-label="GoXAvni home">
          Go<span>X</span>Avni
        </a>
        <div className="header-actions">
          <a href="mailto:contact@goxavni.com">contact@goxavni.com</a>
          <a className="login-link" href="/bookkeeper">Login</a>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <h1 id="hero-title">Go<span>X</span>Avni</h1>
          <p>Moving toward the infinite future.</p>
          <a className="button" href="mailto:contact@goxavni.com">Contact</a>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2026 GoXAvni LLC. All rights reserved.</p>
      </footer>
    </main>
  );
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const endpoint = mode === "signin" ? "/api/login" : "/api/signup";
      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(payload(event.currentTarget))
      });
      onAuth(data.user, data.provider || "supabase");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="login-view">
      <div className="auth-wrap">
        <div className="auth-copy">
          <a className="auth-brand" href="/" aria-label="GoXAvni home">Go<span>X</span>Avni</a>
          <div className="auth-identity">
            <h1>Internal Finance Portal</h1>
          </div>
        </div>

        <div className="login-panel">
          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button className={`auth-tab ${mode === "signin" ? "active" : ""}`} type="button" onClick={() => setMode("signin")}>Sign in</button>
            <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} type="button" onClick={() => setMode("signup")}>Sign up</button>
          </div>

          <form className="stack auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label>
                Name
                <input name="name" type="text" autoComplete="name" required placeholder="Full name" />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required placeholder="you@goxavni.com" />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required placeholder={mode === "signin" ? "Your password" : "At least 8 characters"} />
            </label>
            {mode === "signup" && (
              <label>
                Role code
                <input name="adminCode" type="password" autoComplete="off" required placeholder="Role access code" />
              </label>
            )}
            <button type="submit">{mode === "signin" ? "Sign in" : "Create account"}</button>
            <p className="form-message" role="alert">{message}</p>
          </form>
        </div>
      </div>
    </main>
  );
}

function Table({ columns, rows, empty }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column} className={column === "Amount" || column === "Hours" || column === "Rate" ? "amount" : ""}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows : (
            <tr><td className="empty" colSpan={columns.length}>{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Bookkeeper() {
  const [user, setUser] = useState(null);
  const [provider, setProvider] = useState("supabase");
  const [view, setView] = useState("dashboard");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [data, setData] = useState({
    accounts: [],
    transactions: [],
    summary: { income: 0, expenses: 0, net: 0, transactionCount: 0 },
    categories: [],
    members: [],
    timesheets: [],
    payments: [],
    users: [],
    report: { income: 0, expenses: 0, net: 0, categories: [] }
  });

  const canOwn = user?.role === "owner";
  const canManage = ["owner", "manager"].includes(user?.role);
  const activeMembers = data.members.filter((member) => member.active);
  const assetAccounts = data.accounts.filter((account) => account.active && account.type === "asset");
  const revenueAccounts = data.accounts.filter((account) => account.active && account.type === "revenue");
  const expenseAccounts = data.accounts.filter((account) => account.active && account.type === "expense");

  function flash(text) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function loadCore() {
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
      users: [],
      report: { income: 0, expenses: 0, net: 0, categories: [] }
    };
    if (canManage || ["owner", "manager"].includes(user?.role)) {
      const [users, payments, report] = await Promise.all([
        api("/api/users"),
        api("/api/member-payments"),
        api("/api/reports/profit-loss")
      ]);
      next.users = users.users;
      next.payments = payments.payments;
      next.report = report.report;
    }
    setData(next);
  }

  useEffect(() => {
    api("/api/me")
      .then((data) => {
        setUser(data.user);
        setProvider(data.provider || "supabase");
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user) loadCore().catch((error) => setMessage(error.message));
  }, [user]);

  if (!user) {
    return <Auth onAuth={(nextUser, nextProvider) => { setUser(nextUser); setProvider(nextProvider); }} />;
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

  async function logout() {
    await api("/api/logout", { method: "POST", body: "{}" });
    setUser(null);
  }

  const navItems = [
    ["dashboard", "Dashboard", true],
    ["transactions", "Transactions", true],
    ["members", "Members", true],
    ["timesheets", "Timesheets", true],
    ["payments", "Payments", canManage],
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
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} type="button" onClick={() => setView(id)}>{label}</button>
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
            <button className="ghost" type="button" onClick={logout}><LogOut size={16} /> Sign out</button>
          </div>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}
        {message && <div className="notice error" role="alert">{message}</div>}

        {view === "dashboard" && (
          <section className="view">
            <div className="metric-grid">
              <Metric label="Total income" value={money.format(data.summary.income)} />
              <Metric label="Total expenses" value={money.format(data.summary.expenses)} />
              <Metric label="Net" value={money.format(data.summary.net)} />
              <Metric label="Transactions" value={data.summary.transactionCount} />
            </div>
            <div className="split">
              <Panel title="Recent Activity" action={<button className="ghost" type="button" onClick={() => setView("transactions")}>Add</button>}>
                <Table columns={["Date", "Party", "Type", "Amount"]} empty="No activity yet." rows={data.transactions.slice(0, 6).map((tx) => (
                  <tr key={tx.id}><td>{tx.occurredOn}</td><td>{tx.party}</td><td>{tx.type}</td><td className={`amount ${tx.type === "income" ? "positive" : "negative"}`}>{tx.type === "expense" ? "-" : ""}{money.format(tx.amount)}</td></tr>
                ))} />
              </Panel>
              <Panel title="Top Categories">
                <div className="category-list">
                  {data.categories.length ? data.categories.map((category) => <div className="category-row" key={`${category.type}-${category.name}`}><header><span>{category.name}</span><span>{money.format(category.amount)}</span></header><div className="bar"><span style={{ width: "100%" }} /></div></div>) : <p className="empty">Categories will appear after transactions are saved.</p>}
                </div>
              </Panel>
            </div>
          </section>
        )}

        {view === "transactions" && (
          <section className="view">
            <Panel title="New Transaction">
              <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/transactions", event.currentTarget, "Transaction saved.").catch((error) => setMessage(error.message)); }}>
                <Input name="occurredOn" label="Date" type="date" required />
                <Select name="type" label="Type" options={[["income", "Income"], ["expense", "Expense"]]} required />
                <Input name="amount" label="Amount" type="number" min="0.01" step="0.01" required />
                <Input name="party" label="Party" required />
                <Select name="paymentAccountId" label="Payment account" options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
                <CategorySelect income={revenueAccounts} expense={expenseAccounts} />
                <Input className="wide" name="description" label="Description" required />
                <Input name="reference" label="Reference" />
                <div className="form-actions wide"><button type="submit">Save transaction</button></div>
              </form>
            </Panel>
            <Panel title="Ledger">
              <Table columns={["Date", "Party", "Description", "Category", "Amount"]} empty="No transactions yet." rows={data.transactions.map((tx) => (
                <tr key={tx.id}><td>{tx.occurredOn}</td><td>{tx.party}</td><td>{tx.description}</td><td>{tx.categoryAccount}</td><td className={`amount ${tx.type === "income" ? "positive" : "negative"}`}>{tx.type === "expense" ? "-" : ""}{money.format(tx.amount)}</td></tr>
              ))} />
            </Panel>
          </section>
        )}

        {view === "members" && (
          <section className="view">
            <Panel title="New Member">
              <form className="form-grid compact" onSubmit={(event) => { event.preventDefault(); submit("/api/members", event.currentTarget, "Member added.").catch((error) => setMessage(error.message)); }}>
                <Input name="name" label="Name" required />
                <Input name="email" label="Email" type="email" />
                <Input name="title" label="Title" />
                <Input name="hourlyRate" label="Hourly rate" type="number" min="0" step="0.01" />
                <div className="form-actions wide"><button type="submit"><UserPlus size={16} /> Add member</button></div>
              </form>
            </Panel>
            <Panel title="Members">
              <Table columns={["Name", "Email", "Title", "Rate", "Status"]} empty="No members yet." rows={data.members.map((member) => (
                <tr key={member.id}><td>{member.name}</td><td>{member.email || ""}</td><td>{member.title || ""}</td><td className="amount">{money.format(member.hourlyRate || 0)}</td><td>{member.active ? "Active" : "Inactive"}</td></tr>
              ))} />
            </Panel>
          </section>
        )}

        {view === "timesheets" && (
          <section className="view">
            <Panel title="New Timesheet">
              <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/timesheets", event.currentTarget, "Timesheet saved.").catch((error) => setMessage(error.message)); }}>
                <Select name="memberId" label="Member" options={activeMembers.map((member) => [member.id, member.name])} required />
                <Input name="workDate" label="Date" type="date" required />
                <Input name="hours" label="Hours" type="number" min="0.25" max="24" step="0.25" required />
                <Input name="hourlyRate" label="Hourly rate" type="number" min="0" step="0.01" />
                <Input name="project" label="Project" />
                <Input className="wide" name="notes" label="Notes" />
                <div className="form-actions wide"><button type="submit">Save time</button></div>
              </form>
            </Panel>
            <Panel title="Timesheets">
              <Table columns={["Date", "Member", "Project", "Hours", "Amount", "Status"]} empty="No timesheets yet." rows={data.timesheets.map((entry) => (
                <tr key={entry.id}><td>{entry.workDate}</td><td>{entry.memberName}</td><td>{entry.project || ""}</td><td className="amount">{entry.hours}</td><td className="amount">{money.format(entry.amount || 0)}</td><td>{entry.status}</td></tr>
              ))} />
            </Panel>
          </section>
        )}

        {view === "payments" && (
          <section className="view">
            <Panel title="Pay Member">
              <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/member-payments", event.currentTarget, "Member payment recorded.").catch((error) => setMessage(error.message)); }}>
                <Select name="memberId" label="Member" options={activeMembers.map((member) => [member.id, member.name])} required />
                <Input name="paidOn" label="Paid on" type="date" required />
                <Input name="amount" label="Amount" type="number" min="0.01" step="0.01" required />
                <Select name="paymentAccountId" label="Payment account" options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
                <Select name="expenseAccountId" label="Expense account" options={expenseAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
                <Input name="reference" label="Reference" />
                <Input name="periodStart" label="Period start" type="date" />
                <Input name="periodEnd" label="Period end" type="date" />
                <Input className="wide" name="notes" label="Notes" />
                <div className="form-actions wide"><button type="submit">Record payment</button></div>
              </form>
            </Panel>
            <Panel title="Member Payments">
              <Table columns={["Date", "Member", "Reference", "Amount"]} empty="No member payments yet." rows={data.payments.map((payment) => (
                <tr key={payment.id}><td>{payment.paidOn}</td><td>{payment.memberName}</td><td>{payment.reference || ""}</td><td className="amount negative">-{money.format(payment.amount)}</td></tr>
              ))} />
            </Panel>
          </section>
        )}

        {view === "reports" && (
          <section className="view">
            <Panel title="Reports" action={<div className="report-actions"><a className="ghost link-button" href="/api/reports/transactions.csv"><Download size={15} /> Transactions CSV</a><a className="ghost link-button" href="/api/reports/timesheets.csv"><Download size={15} /> Timesheets CSV</a><a className="ghost link-button" href="/api/reports/member-payments.csv"><Download size={15} /> Payments CSV</a></div>}>
              <form className="form-grid compact" onSubmit={async (event) => { event.preventDefault(); const params = new URLSearchParams(Object.entries(payload(event.currentTarget)).filter((entry) => entry[1])); const result = await api(`/api/reports/profit-loss?${params}`); setData((current) => ({ ...current, report: result.report })); }}>
                <Input name="from" label="From" type="date" />
                <Input name="to" label="To" type="date" />
                <div className="form-actions"><button type="submit">Run report</button></div>
              </form>
            </Panel>
            <div className="metric-grid">
              <Metric label="Income" value={money.format(data.report.income || 0)} />
              <Metric label="Expenses" value={money.format(data.report.expenses || 0)} />
              <Metric label="Net" value={money.format(data.report.net || 0)} />
            </div>
            <Panel title="Profit and Loss">
              <Table columns={["Category", "Type", "Amount"]} empty="No report data yet." rows={(data.report.categories || []).map((category) => (
                <tr key={`${category.type}-${category.name}`}><td>{category.name}</td><td>{category.type}</td><td className="amount">{money.format(category.amount || 0)}</td></tr>
              ))} />
            </Panel>
          </section>
        )}

        {view === "accounts" && (
          <section className="view">
            <Panel title="New Account" action={!canOwn && <span className="role-note">Only owners can change accounts</span>}>
              <form className="form-grid compact" onSubmit={(event) => { event.preventDefault(); submit("/api/accounts", event.currentTarget, "Account added.").catch((error) => setMessage(error.message)); }}>
                <Input name="code" label="Code" required />
                <Input name="name" label="Name" required />
                <Select name="type" label="Type" options={[["asset", "Asset"], ["liability", "Liability"], ["equity", "Equity"], ["revenue", "Revenue"], ["expense", "Expense"]]} required />
                <div className="form-actions"><button type="submit" disabled={!canOwn}>Add account</button></div>
              </form>
            </Panel>
            <Panel title="Chart of Accounts">
              <Table columns={["Code", "Name", "Type", "Status"]} empty="No accounts yet." rows={data.accounts.map((account) => (
                <tr key={account.id}><td>{account.code}</td><td>{account.name}</td><td>{account.type}</td><td>{account.active ? "Active" : "Inactive"}</td></tr>
              ))} />
            </Panel>
          </section>
        )}

        {view === "users" && (
          <section className="view">
            <Panel title="New User">
              <form className="form-grid compact" onSubmit={(event) => { event.preventDefault(); submit("/api/users", event.currentTarget, "User created.").catch((error) => setMessage(error.message)); }}>
                <Input name="name" label="Name" required />
                <Input name="email" label="Email" type="email" required />
                <Select name="role" label="Role" options={(user.role === "manager" ? [["member", "Member"]] : [["owner", "Owner"], ["manager", "Manager"], ["member", "Member"]])} required />
                <Input name="password" label="Temporary password" type="password" minLength="8" required />
                <div className="form-actions wide"><button type="submit"><Plus size={16} /> Create user</button></div>
              </form>
            </Panel>
            <Panel title="Access">
              <Table columns={["Name", "Email", "Role", "Status"]} empty="No users yet." rows={data.users.map((row) => (
                <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.role}</td><td>{row.active ? "Active" : "Inactive"}</td></tr>
              ))} />
            </Panel>
          </section>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

function Panel({ title, action, children }) {
  return <section className="panel"><div className="panel-title"><h2>{title}</h2>{action}</div>{children}</section>;
}

function Input({ label, className = "", ...props }) {
  return <label className={className}>{label}<input {...props} /></label>;
}

function Select({ label, options, className = "", ...props }) {
  return <label className={className}>{label}<select {...props}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function CategorySelect({ income, expense }) {
  const [type, setType] = useState("income");
  useEffect(() => {
    const select = document.querySelector('select[name="type"]');
    if (!select) return undefined;
    const listener = () => setType(select.value);
    select.addEventListener("change", listener);
    listener();
    return () => select.removeEventListener("change", listener);
  }, []);
  const options = type === "income" ? income : expense;
  return <Select name="categoryAccountId" label="Category" options={options.map((account) => [account.id, `${account.code} - ${account.name}`])} required />;
}

function App() {
  return window.location.pathname.startsWith("/bookkeeper") ? <Bookkeeper /> : <Home />;
}

createRoot(document.getElementById("root")).render(<App />);
