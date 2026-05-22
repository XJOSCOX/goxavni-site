import React, { useState } from "react";
import { ExternalLink, Upload } from "lucide-react";
import { DeleteButton, Input, Panel, Select, Table } from "../components.jsx";
import { api, messageForError, payload } from "../api.js";

const entityOptions = [
  ["transaction", "Transaction"],
  ["invoice", "Invoice"],
  ["member_payment", "Member Payment"],
  ["subscription", "Subscription"],
  ["contact", "Contact"],
  ["timesheet", "Timesheet"]
];

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function Documents({ data, submit, deleteRecord, setMessage, refreshData }) {
  const [uploading, setUploading] = useState(false);

  return (
    <section className="view">
      <Panel title="Upload Document">
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const file = form.elements.file.files?.[0];
          if (!file) {
            setMessage("Choose a file to upload.");
            return;
          }
          setUploading(true);
          setMessage("");
          try {
            const body = payload(form);
            delete body.file;
            await api("/api/documents/upload", {
              method: "POST",
              body: JSON.stringify({
                ...body,
                filename: file.name,
                contentType: file.type || "application/octet-stream",
                contentBase64: await fileToBase64(file)
              })
            });
            form.reset();
            await refreshData();
            setMessage("Document uploaded.");
          } catch (error) {
            setMessage(messageForError(error));
          } finally {
            setUploading(false);
          }
        }}>
          <Input name="label" label="Label" required />
          <Input name="file" label="File" type="file" required />
          <Select name="entityType" label="Record type" options={entityOptions} required />
          <Input name="entityId" label="Record ID" required />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions"><button type="submit" disabled={uploading}><Upload size={15} /> {uploading ? "Uploading" : "Upload file"}</button></div>
        </form>
      </Panel>

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
        <Table columns={["Label", "Record", "Source", "Created By", "Notes", "Actions"]} empty="No documents yet." rows={data.documents.map((document) => (
          <tr key={document.id}>
            <td>{document.label}</td>
            <td>{document.entityType} #{document.entityId}</td>
            <td>
              {document.url ? (
                <a className="table-link" href={document.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {document.storagePath ? "Open file" : "Open link"}</a>
              ) : "Unavailable"}
            </td>
            <td>{document.createdBy}</td>
            <td>{document.notes || ""}</td>
            <td><DeleteButton title="Delete document" onDelete={() => deleteRecord(`/api/documents/${document.id}`, "document")} /></td>
          </tr>
        ))} />
      </Panel>
    </section>
  );
}
