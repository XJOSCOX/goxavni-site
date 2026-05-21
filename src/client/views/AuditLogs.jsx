import React from "react";
import { Panel, Table } from "../components.jsx";

function shortDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

export function AuditLogs({ data }) {
  return (
    <section className="view">
      <Panel title="Audit Logs">
        <Table columns={["When", "Actor", "Action", "Record", "Summary"]} empty="No audit activity yet." rows={data.auditLogs.map((entry) => (
          <tr key={entry.id}>
            <td>{shortDate(entry.createdAt)}</td>
            <td>{entry.actorName || entry.actorEmail}</td>
            <td>{entry.action}</td>
            <td>{entry.entityType} #{entry.entityId}</td>
            <td>{entry.summary || ""}</td>
          </tr>
        ))} />
      </Panel>
    </section>
  );
}
