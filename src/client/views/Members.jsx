import React from "react";
import { Edit3, UserPlus } from "lucide-react";
import { EditActions, EditInput, EditSelect, Input, Panel, Table } from "../components.jsx";
import { money } from "../api.js";

export function Members({ data, canManage, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, setMessage }) {
  return (
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
        <Table columns={["Name", "Email", "Title", "Rate", "Status", "Actions"]} empty="No members yet." rows={data.members.map((member) => {
          const rowEditing = isEditing("member", member.id);
          return rowEditing ? (
            <tr key={member.id}>
              <td><EditInput value={editing.values.name} onChange={(value) => setEditValue("name", value)} /></td>
              <td><EditInput type="email" value={editing.values.email} onChange={(value) => setEditValue("email", value)} /></td>
              <td><EditInput value={editing.values.title} onChange={(value) => setEditValue("title", value)} /></td>
              <td className="amount"><EditInput type="number" min="0" step="0.01" value={editing.values.hourlyRate} onChange={(value) => setEditValue("hourlyRate", value)} /></td>
              <td><EditSelect value={editing.values.active} options={[["true", "Active"], ["false", "Inactive"]]} onChange={(value) => setEditValue("active", value)} /></td>
              <td><EditActions onSave={() => saveEdit(`/api/members/${member.id}`, "Member updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} /></td>
            </tr>
          ) : (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.email || ""}</td>
              <td>{member.title || ""}</td>
              <td className="amount">{money.format(member.hourlyRate || 0)}</td>
              <td>{member.active ? "Active" : "Inactive"}</td>
              <td>{canManage && <button className="icon-button ghost" type="button" title="Edit member" onClick={() => startEdit("member", member.id, { name: member.name, email: member.email || "", title: member.title || "", hourlyRate: member.hourlyRate || 0, active: String(member.active), userId: member.userId || "" })}><Edit3 size={15} /></button>}</td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
