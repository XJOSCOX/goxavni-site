import React from "react";
import { ExternalLink } from "lucide-react";
import { Input, Panel, Select, Table } from "../components.jsx";

const entityOptions = [
  ["transaction", "Transaction"],
  ["invoice", "Invoice"],
  ["member_payment", "Member Payment"],
  ["subscription", "Subscription"],
  ["contact", "Contact"],
  ["timesheet", "Timesheet"]
];

export function Documents({ data, submit, setMessage }) {
  return (
    <section className="view">
      <Panel title="New Document Link">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/documents", event.currentTarget, "Document saved.").catch((error) => setMessage(error.message)); }}>
          <Input name="label" label="Label" required />
          <Input name="url" label="URL" type="url" required />
          <Select name="entityType" label="Record type" options={entityOptions} required />
          <Input name="entityId" label="Record ID" required />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions"><button type="submit">Save document</button></div>
        </form>
      </Panel>

      <Panel title="Documents">
        <Table columns={["Label", "Record", "URL", "Created By", "Notes"]} empty="No documents yet." rows={data.documents.map((document) => (
          <tr key={document.id}>
            <td>{document.label}</td>
            <td>{document.entityType} #{document.entityId}</td>
            <td><a className="table-link" href={document.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a></td>
            <td>{document.createdBy}</td>
            <td>{document.notes || ""}</td>
          </tr>
        ))} />
      </Panel>
    </section>
  );
}
