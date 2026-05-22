import React from "react";
import { Edit3 } from "lucide-react";
import { DeleteButton, EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";

const accountTypeOptions = [["asset", "Asset"], ["liability", "Liability"], ["equity", "Equity"], ["revenue", "Revenue"], ["expense", "Expense"]];

export function Accounts({ data, canOwn, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, deleteRecord, submit, setMessage }) {
  return (
    <section className="view">
      <Panel title="New Account" action={!canOwn && <span className="role-note">Only owners can change accounts and categories</span>}>
        <form className="form-grid compact" onSubmit={(event) => { event.preventDefault(); submit("/api/accounts", event.currentTarget, "Account added.").catch((error) => setMessage(error.message)); }}>
          <Input name="code" label="Code" required />
          <Input name="name" label="Name" required />
          <Select name="type" label="Type" options={accountTypeOptions} required />
          <div className="form-actions"><button type="submit" disabled={!canOwn}>Add account</button></div>
        </form>
      </Panel>
      <Panel title="Chart of Accounts">
        <Table columns={["Code", "Name", "Type", "Status", "Actions"]} empty="No accounts yet." rows={data.accounts.map((account) => {
          const rowEditing = isEditing("account", account.id);
          return rowEditing ? (
            <tr key={account.id}>
              <td><EditInput value={editing.values.code} onChange={(value) => setEditValue("code", value)} /></td>
              <td><EditInput value={editing.values.name} onChange={(value) => setEditValue("name", value)} /></td>
              <td><EditSelect value={editing.values.type} options={accountTypeOptions} onChange={(value) => setEditValue("type", value)} /></td>
              <td><EditSelect value={editing.values.active} options={[["true", "Active"], ["false", "Inactive"]]} onChange={(value) => setEditValue("active", value)} /></td>
              <td><EditActions onSave={() => saveEdit(`/api/accounts/${account.id}`, "Account updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} /></td>
            </tr>
          ) : (
            <tr key={account.id}>
              <td>{account.code}</td>
              <td>{account.name}</td>
              <td>{account.type}</td>
              <td>{account.active ? "Active" : "Inactive"}</td>
              <td>{canOwn && <div className="row-actions"><button className="icon-button ghost" type="button" title="Edit account" onClick={() => startEdit("account", account.id, { code: account.code, name: account.name, type: account.type, active: String(account.active) })}><Edit3 size={15} /></button><DeleteButton title="Delete account" onDelete={() => deleteRecord(`/api/accounts/${account.id}`, "account")} /></div>}</td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
