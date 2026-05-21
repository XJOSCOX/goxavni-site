import React from "react";
import { Metric, Panel, Table } from "../components.jsx";
import { money } from "../api.js";

export function Dashboard({ data, setView }) {
  return (
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
  );
}
