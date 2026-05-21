import React from "react";
import { Edit3 } from "lucide-react";
import { EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";

const typeOptions = [["customer", "Customer"], ["vendor", "Vendor"]];

export function Contacts({ data, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, setMessage }) {
  return (
    <section className="view">
      <Panel title="New Contact">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/contacts", event.currentTarget, "Contact saved.").catch((error) => setMessage(error.message)); }}>
          <Select name="type" label="Type" options={typeOptions} required />
          <Input name="name" label="Name" required />
          <Input name="company" label="Company" />
          <Input name="email" label="Email" type="email" />
          <Input name="phone" label="Phone" />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions"><button type="submit">Save contact</button></div>
        </form>
      </Panel>

      <Panel title="Contacts" action={<a className="ghost link-button" href="/api/reports/contacts.csv">Contacts CSV</a>}>
        <Table columns={["Type", "Name", "Company", "Email", "Phone", "Status", "Actions"]} empty="No contacts yet." rows={data.contacts.map((contact) => {
          const rowEditing = isEditing("contact", contact.id);
          return rowEditing ? (
            <tr key={contact.id}>
              <td><EditSelect value={editing.values.type} options={typeOptions} onChange={(value) => setEditValue("type", value)} /></td>
              <td><EditInput value={editing.values.name} onChange={(value) => setEditValue("name", value)} /></td>
              <td><EditInput value={editing.values.company} onChange={(value) => setEditValue("company", value)} /></td>
              <td><EditInput type="email" value={editing.values.email} onChange={(value) => setEditValue("email", value)} /></td>
              <td><EditInput value={editing.values.phone} onChange={(value) => setEditValue("phone", value)} /></td>
              <td><EditSelect value={editing.values.active} options={[["true", "Active"], ["false", "Inactive"]]} onChange={(value) => setEditValue("active", value)} /></td>
              <td>
                <div className="inline-stack compact-stack">
                  <EditInput value={editing.values.notes} placeholder="Notes" onChange={(value) => setEditValue("notes", value)} />
                  <EditActions onSave={() => saveEdit(`/api/contacts/${contact.id}`, "Contact updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} />
                </div>
              </td>
            </tr>
          ) : (
            <tr key={contact.id}>
              <td>{contact.type}</td>
              <td>{contact.name}</td>
              <td>{contact.company || ""}</td>
              <td>{contact.email || ""}</td>
              <td>{contact.phone || ""}</td>
              <td>{contact.active ? "Active" : "Inactive"}</td>
              <td><button className="icon-button ghost" type="button" title="Edit contact" onClick={() => startEdit("contact", contact.id, { type: contact.type, name: contact.name, company: contact.company || "", email: contact.email || "", phone: contact.phone || "", notes: contact.notes || "", active: String(contact.active) })}><Edit3 size={15} /></button></td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
