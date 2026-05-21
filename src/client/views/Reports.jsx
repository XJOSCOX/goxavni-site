import React from "react";
import { Download } from "lucide-react";
import { Input, Metric, Panel, Table } from "../components.jsx";
import { api, money, payload } from "../api.js";

export function Reports({ data, setData }) {
  return (
    <section className="view">
      <Panel title="Reports" action={<div className="report-actions"><a className="ghost link-button" href="/api/reports/transactions.csv"><Download size={15} /> Transactions CSV</a><a className="ghost link-button" href="/api/reports/timesheets.csv"><Download size={15} /> Timesheets CSV</a><a className="ghost link-button" href="/api/reports/member-payments.csv"><Download size={15} /> Payments CSV</a><a className="ghost link-button" href="/api/reports/subscriptions.csv"><Download size={15} /> Subscriptions CSV</a></div>}>
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
  );
}
