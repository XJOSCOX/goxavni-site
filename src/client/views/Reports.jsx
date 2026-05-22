import React from "react";
import { Download } from "lucide-react";
import { Input, Metric, Panel, Table } from "../components.jsx";
import { api, messageForError, money, payload } from "../api.js";

function queryFrom(values, map = {}) {
  const entries = Object.entries(values)
    .filter((entry) => entry[1])
    .map(([key, value]) => [map[key] || key, value]);
  const params = new URLSearchParams(entries);
  return params.toString();
}

function BalanceSection({ title, rows }) {
  return (
    <Panel title={title}>
      <Table columns={["Code", "Account", "Amount"]} empty={`No ${title.toLowerCase()} yet.`} rows={rows.map((row) => (
        <tr key={`${title}-${row.id}`}>
          <td>{row.code}</td>
          <td>{row.name}</td>
          <td className="amount">{money.format(row.amount || 0)}</td>
        </tr>
      ))} />
    </Panel>
  );
}

export function Reports({ data, setData, setMessage, refreshData, canOwn }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="view">
      <Panel title="Reports" action={<div className="report-actions"><a className="ghost link-button" href="/api/reports/transactions.csv"><Download size={15} /> Transactions CSV</a><a className="ghost link-button" href="/api/reports/timesheets.csv"><Download size={15} /> Timesheets CSV</a><a className="ghost link-button" href="/api/reports/member-payments.csv"><Download size={15} /> Payments CSV</a><a className="ghost link-button" href="/api/reports/subscriptions.csv"><Download size={15} /> Subscriptions CSV</a><a className="ghost link-button" href="/api/reports/invoices.csv"><Download size={15} /> Invoices CSV</a><a className="ghost link-button" href="/api/reports/contacts.csv"><Download size={15} /> Contacts CSV</a><a className="ghost link-button" href="/api/reports/reminders.csv"><Download size={15} /> Reminders CSV</a><a className="ghost link-button" href="/api/reports/balance-sheet.csv"><Download size={15} /> Balance Sheet CSV</a><a className="ghost link-button" href="/api/reports/cash-flow.csv"><Download size={15} /> Cash Flow CSV</a></div>}>
        <form className="form-grid compact" onSubmit={async (event) => {
          event.preventDefault();
          setMessage("");
          try {
            const values = payload(event.currentTarget);
            const range = queryFrom(values);
            const asOf = queryFrom(values, { to: "asOf" });
            const [profitLoss, balanceSheet, cashFlow] = await Promise.all([
              api(`/api/reports/profit-loss${range ? `?${range}` : ""}`),
              api(`/api/reports/balance-sheet${asOf ? `?${asOf}` : ""}`),
              api(`/api/reports/cash-flow${range ? `?${range}` : ""}`)
            ]);
            setData((current) => ({
              ...current,
              report: profitLoss.report,
              balanceSheet: balanceSheet.report,
              cashFlow: cashFlow.report
            }));
          } catch (error) {
            setMessage(messageForError(error));
          }
        }}>
          <Input name="from" label="From" type="date" />
          <Input name="to" label="To / As of" type="date" />
          <div className="form-actions"><button type="submit">Run reports</button></div>
        </form>
      </Panel>

      <div className="metric-grid">
        <Metric label="Income" value={money.format(data.report.income || 0)} />
        <Metric label="Expenses" value={money.format(data.report.expenses || 0)} />
        <Metric label="Net" value={money.format(data.report.net || 0)} />
        <Metric label="Cash Flow" value={money.format(data.cashFlow.net || 0)} />
      </div>

      <Panel title="Profit and Loss">
        <Table columns={["Category", "Type", "Amount"]} empty="No report data yet." rows={(data.report.categories || []).map((category) => (
          <tr key={`${category.type}-${category.name}`}><td>{category.name}</td><td>{category.type}</td><td className="amount">{money.format(category.amount || 0)}</td></tr>
        ))} />
      </Panel>

      <div className="metric-grid">
        <Metric label="Assets" value={money.format(data.balanceSheet.totals?.assets || 0)} />
        <Metric label="Liabilities" value={money.format(data.balanceSheet.totals?.liabilities || 0)} />
        <Metric label="Equity" value={money.format(data.balanceSheet.totals?.equity || 0)} />
        <Metric label="Liabilities + Equity" value={money.format(data.balanceSheet.totals?.liabilitiesAndEquity || 0)} />
      </div>

      <BalanceSection title="Assets" rows={data.balanceSheet.assets || []} />
      <BalanceSection title="Liabilities" rows={data.balanceSheet.liabilities || []} />
      <BalanceSection title="Equity" rows={data.balanceSheet.equity || []} />

      <Panel title="Cash Flow">
        <Table columns={["Month", "Type", "Category", "Inflow", "Outflow", "Net"]} empty="No cash flow data yet." rows={(data.cashFlow.rows || []).map((row) => (
          <tr key={`${row.month}-${row.type}-${row.category}`}>
            <td>{row.month}</td>
            <td>{row.type}</td>
            <td>{row.category}</td>
            <td className="amount">{money.format(row.inflow || 0)}</td>
            <td className="amount">{money.format(row.outflow || 0)}</td>
            <td className="amount">{money.format(row.net || 0)}</td>
          </tr>
        ))} />
      </Panel>

      <Panel title="Monthly Close">
        {canOwn && (
          <form className="form-grid compact" onSubmit={async (event) => {
            event.preventDefault();
            setMessage("");
            try {
              await api("/api/monthly-closes", {
                method: "POST",
                body: JSON.stringify(payload(event.currentTarget))
              });
              event.currentTarget.reset();
              await refreshData();
              setMessage("Month closed.");
            } catch (error) {
              setMessage(messageForError(error));
            }
          }}>
            <Input name="period" label="Period" type="month" required />
            <Input name="closedOn" label="Closed on" type="date" defaultValue={today} required />
            <div className="form-actions"><button type="submit">Close month</button></div>
          </form>
        )}
        <Table columns={["Period", "Closed On", "Created By", "Created At", "Net"]} empty="No monthly closes yet." rows={(data.monthlyCloses || []).map((close) => (
          <tr key={close.id}>
            <td>{close.period}</td>
            <td>{close.closedOn}</td>
            <td>{close.createdBy}</td>
            <td>{new Date(close.createdAt).toLocaleString()}</td>
            <td className="amount">{money.format(close.summary?.profitLoss?.net || 0)}</td>
          </tr>
        ))} />
      </Panel>
    </section>
  );
}
