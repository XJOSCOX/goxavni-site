import React from "react";
import { Edit3, Plus } from "lucide-react";
import { EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";

export function Users({ user, data, roleOptions, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, setMessage }) {
  return (
    <section className="view">
      <Panel title="New User">
        <form className="form-grid compact" onSubmit={(event) => { event.preventDefault(); submit("/api/users", event.currentTarget, "User created.").catch((error) => setMessage(error.message)); }}>
          <Input name="name" label="Name" required />
          <Input name="email" label="Email" type="email" required />
          <Select name="role" label="Role" options={roleOptions} required />
          <Input name="password" label="Temporary password" type="password" minLength="8" required />
          <div className="form-actions wide"><button type="submit"><Plus size={16} /> Create user</button></div>
        </form>
      </Panel>
      <Panel title="Access">
        <Table columns={["Name", "Email", "Role", "Status", "Actions"]} empty="No users yet." rows={data.users.map((row) => {
          const rowEditing = isEditing("user", row.id);
          const canEditRow = user.role === "owner" || row.role === "member";
          return rowEditing ? (
            <tr key={row.id}>
              <td><EditInput value={editing.values.name} onChange={(value) => setEditValue("name", value)} /></td>
              <td><EditInput type="email" value={editing.values.email} onChange={(value) => setEditValue("email", value)} /></td>
              <td><EditSelect value={editing.values.role} options={roleOptions} onChange={(value) => setEditValue("role", value)} /></td>
              <td><EditSelect value={editing.values.active} options={[["true", "Active"], ["false", "Inactive"]]} onChange={(value) => setEditValue("active", value)} /></td>
              <td><EditActions onSave={() => saveEdit(`/api/users/${row.id}`, "User updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} /></td>
            </tr>
          ) : (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.email}</td>
              <td>{row.role}</td>
              <td>{row.active ? "Active" : "Inactive"}</td>
              <td>{canEditRow && <button className="icon-button ghost" type="button" title="Edit user" onClick={() => startEdit("user", row.id, { name: row.name, email: row.email, role: row.role, active: String(row.active) })}><Edit3 size={15} /></button>}</td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
