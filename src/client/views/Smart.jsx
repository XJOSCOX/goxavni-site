import React from "react";
import { RefreshCw } from "lucide-react";
import { api, money } from "../api.js";
import { Metric, Panel, Table } from "../components.jsx";

function insightValue(insight) {
  return typeof insight.value === "number" && insight.title !== "Current net" ? insight.value : money.format(insight.value);
}

export function Smart({ data, setData, setMessage }) {
  const smart = data.smart;

  async function refresh() {
    setMessage("");
    const result = await api("/api/smart");
    setData((current) => ({ ...current, smart: result.smart }));
  }

  return (
    <section className="view">
      <div className="metric-grid compact-metrics">
        <Metric label="Overdue" value={smart.metrics.overdueReminders} />
        <Metric label="Due this week" value={smart.metrics.dueSoonReminders} />
        <Metric label="Recurring due" value={smart.metrics.upcomingSubscriptions} />
        <Metric label="Waiting timesheets" value={smart.metrics.pendingTimesheets} />
      </div>

      <Panel title="Smart Signals" action={<button className="ghost" type="button" onClick={() => refresh().catch((error) => setMessage(error.message))}><RefreshCw size={16} /> Refresh</button>}>
        <div className="smart-grid">
          {smart.insights.length ? smart.insights.map((insight) => (
            <article className={`smart-card tone-${insight.tone}`} key={insight.title}>
              <span>{insight.title}</span>
              <strong>{insightValue(insight)}</strong>
              <p>{insight.action}</p>
            </article>
          )) : <p className="empty smart-empty">No smart signals yet.</p>}
        </div>
      </Panel>

      <div className="split">
        <Panel title="Reminder Focus">
          <Table columns={["Due", "Title", "Priority", "Status"]} empty="No urgent reminders." rows={smart.reminders.map((reminder) => (
            <tr key={reminder.id}>
              <td>{reminder.dueOn}{reminder.dueTime ? ` ${reminder.dueTime}` : ""}</td>
              <td>{reminder.title}</td>
              <td><span className={`status-pill priority-${reminder.priority}`}>{reminder.priority}</span></td>
              <td>{reminder.status}</td>
            </tr>
          ))} />
        </Panel>

        <Panel title="Upcoming Recurring">
          <Table columns={["Due", "Vendor", "Amount"]} empty="No recurring expenses due soon." rows={smart.subscriptions.map((subscription) => (
            <tr key={subscription.id}>
              <td>{subscription.nextDueOn}</td>
              <td>{subscription.vendor}</td>
              <td className="amount negative">-{money.format(subscription.amount)}</td>
            </tr>
          ))} />
        </Panel>
      </div>
    </section>
  );
}
