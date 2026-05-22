import React from "react";
import { Metric, Panel, Table } from "../components.jsx";
import { money } from "../api.js";

function monthKey(date) {
  return String(date || "").slice(0, 7);
}

function lastMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}

function percent(value, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function buildMonthlyRows(transactions) {
  const months = lastMonths(6);
  const rows = new Map(months.map((month) => [month, { month, income: 0, expenses: 0, net: 0 }]));
  for (const tx of transactions) {
    const month = monthKey(tx.occurredOn);
    if (!rows.has(month)) continue;
    const current = rows.get(month);
    if (tx.type === "income") current.income += Number(tx.amount || 0);
    if (tx.type === "expense") current.expenses += Number(tx.amount || 0);
    current.net = current.income - current.expenses;
  }
  return [...rows.values()];
}

function BarChart({ rows }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.income, row.expenses]));
  return (
    <div className="chart-bars" role="img" aria-label="Income and expenses by month">
      {rows.map((row) => (
        <div className="chart-month" key={row.month}>
          <div className="chart-columns">
            <span className="income-bar" style={{ height: `${Math.max(4, percent(row.income, max))}%` }} title={`Income ${money.format(row.income)}`} />
            <span className="expense-bar" style={{ height: `${Math.max(4, percent(row.expenses, max))}%` }} title={`Expenses ${money.format(row.expenses)}`} />
          </div>
          <strong>{row.month.slice(5)}</strong>
        </div>
      ))}
    </div>
  );
}

function NetLine({ rows }) {
  const values = rows.map((row) => row.net);
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  const points = values.map((value, index) => {
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    const y = 50 - (value / max) * 42;
    return `${x},${Math.max(6, Math.min(94, y))}`;
  }).join(" ");
  return (
    <div className="line-chart" role="img" aria-label="Net trend">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" />
        <polyline points={points} />
      </svg>
      <div className="chart-legend">
        <span>Net trend</span>
        <strong>{money.format(rows.reduce((total, row) => total + row.net, 0))}</strong>
      </div>
    </div>
  );
}

function InsightCard({ tone = "neutral", label, value, detail, action, onClick }) {
  return (
    <article className={`insight-card insight-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      {action && <button className="ghost" type="button" onClick={onClick}>{action}</button>}
    </article>
  );
}

export function Dashboard({ data, setView, canManage }) {
  const monthlyRows = buildMonthlyRows(data.transactions);
  const openInvoices = data.invoices.filter((invoice) => !["paid", "void"].includes(invoice.status));
  const overdueInvoices = openInvoices.filter((invoice) => invoice.dueOn && invoice.dueOn < new Date().toISOString().slice(0, 10));
  const openInvoiceTotal = openInvoices.reduce((total, invoice) => total + Number(invoice.amount || 0), 0);
  const recurringExpense = data.subscriptions
    .filter((subscription) => subscription.active)
    .reduce((total, subscription) => total + Number(subscription.amount || 0), 0);
  const recurringRevenue = data.productSubscriptions
    .filter((subscription) => subscription.status === "active")
    .reduce((total, subscription) => total + Number(subscription.amount || 0), 0);
  const pendingTimesheets = data.timesheets.filter((timesheet) => timesheet.status === "submitted");
  const lowStock = data.products.filter((product) => product.active && product.lowStock);
  const cash = data.balanceSheet.totals?.assets ?? data.summary.net;

  return (
    <section className="view dashboard-view">
      <div className="metric-grid">
        <Metric label="Total income" value={money.format(data.summary.income)} />
        <Metric label="Total expenses" value={money.format(data.summary.expenses)} />
        <Metric label="Net" value={money.format(data.summary.net)} />
        <Metric label="Cash / assets" value={money.format(cash || 0)} />
      </div>

      <div className="insight-grid">
        {canManage && <InsightCard tone={overdueInvoices.length ? "danger" : "good"} label="Receivables" value={money.format(openInvoiceTotal)} detail={`${overdueInvoices.length} overdue invoices`} action="Invoices" onClick={() => setView("invoices")} />}
        {canManage && <InsightCard tone={recurringRevenue >= recurringExpense ? "good" : "warning"} label="Recurring spread" value={money.format(recurringRevenue - recurringExpense)} detail={`${money.format(recurringRevenue)} revenue vs ${money.format(recurringExpense)} expenses`} action="Products" onClick={() => setView("products")} />}
        <InsightCard tone={pendingTimesheets.length ? "warning" : "good"} label="Timesheets" value={pendingTimesheets.length} detail="Submitted entries waiting for review" action="Timesheets" onClick={() => setView("timesheets")} />
        {canManage && <InsightCard tone={lowStock.length ? "danger" : "good"} label="Low stock" value={lowStock.length} detail="Products at or below reorder level" action="Products" onClick={() => setView("products")} />}
      </div>

      <Panel title="Six Month Flow">
        <div className="chart-panel">
          <BarChart rows={monthlyRows} />
          <NetLine rows={monthlyRows} />
          <div className="chart-key">
            <span><i className="income-dot" /> Income</span>
            <span><i className="expense-dot" /> Expenses</span>
          </div>
        </div>
      </Panel>

      <Panel title="Recent Activity" action={<button className="ghost" type="button" onClick={() => setView("transactions")}>Add</button>}>
        <Table columns={["Date", "Party", "Type", "Amount"]} empty="No activity yet." rows={data.transactions.slice(0, 8).map((tx) => (
          <tr key={tx.id}><td>{tx.occurredOn}</td><td>{tx.party}</td><td>{tx.type}</td><td className={`amount ${tx.type === "income" ? "positive" : "negative"}`}>{tx.type === "expense" ? "-" : ""}{money.format(tx.amount)}</td></tr>
        ))} />
      </Panel>

    </section>
  );
}
