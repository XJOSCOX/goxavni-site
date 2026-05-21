import React from "react";
import { Edit3 } from "lucide-react";
import { EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";
import { money } from "../api.js";

const frequencyOptions = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"]];

function frequencyText(subscription) {
  const unit = subscription.frequencyUnit;
  const label = subscription.frequencyEvery === 1 ? unit : `${unit}s`;
  return `Every ${subscription.frequencyEvery} ${label}`;
}

export function Subscriptions({ data, assetAccounts, expenseAccounts, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, setMessage }) {
  const activeTotal = data.subscriptions
    .filter((subscription) => subscription.active)
    .reduce((total, subscription) => total + Number(subscription.amount || 0), 0);

  return (
    <section className="view">
      <div className="metric-grid compact-metrics">
        <article className="metric"><span>Active subscriptions</span><strong>{data.subscriptions.filter((subscription) => subscription.active).length}</strong></article>
        <article className="metric"><span>Recurring amount</span><strong>{money.format(activeTotal)}</strong></article>
      </div>

      <Panel title="New Subscription">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/subscriptions", event.currentTarget, "Subscription saved.").catch((error) => setMessage(error.message)); }}>
          <Input name="vendor" label="Vendor" required />
          <Input name="description" label="Description" required />
          <Input name="amount" label="Amount" type="number" min="0.01" step="0.01" required />
          <Select name="paymentAccountId" label="Payment account" options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
          <Select name="expenseAccountId" label="Expense account" options={expenseAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
          <Input name="frequencyEvery" label="Repeat every" type="number" min="1" max="365" defaultValue="1" required />
          <Select name="frequencyUnit" label="Unit" options={frequencyOptions} required />
          <Input name="startOn" label="Start date" type="date" required />
          <Input name="nextDueOn" label="Next due" type="date" required />
          <Input name="endOn" label="End date" type="date" />
          <Input name="reference" label="Reference" />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions wide"><button type="submit">Save subscription</button></div>
        </form>
      </Panel>

      <Panel title="Subscriptions" action={<a className="ghost link-button" href="/api/reports/subscriptions.csv">Subscriptions CSV</a>}>
        <Table columns={["Vendor", "Description", "Amount", "Frequency", "Next Due", "Status", "Actions"]} empty="No subscriptions yet." rows={data.subscriptions.map((subscription) => {
          const rowEditing = isEditing("subscription", subscription.id);
          return rowEditing ? (
            <tr key={subscription.id}>
              <td><EditInput value={editing.values.vendor} onChange={(value) => setEditValue("vendor", value)} /></td>
              <td><EditInput value={editing.values.description} onChange={(value) => setEditValue("description", value)} /></td>
              <td className="amount"><EditInput type="number" min="0.01" step="0.01" value={editing.values.amount} onChange={(value) => setEditValue("amount", value)} /></td>
              <td>
                <div className="inline-stack">
                  <EditInput type="number" min="1" max="365" value={editing.values.frequencyEvery} onChange={(value) => setEditValue("frequencyEvery", value)} />
                  <EditSelect value={editing.values.frequencyUnit} options={frequencyOptions} onChange={(value) => setEditValue("frequencyUnit", value)} />
                  <EditSelect value={editing.values.paymentAccountId} options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("paymentAccountId", value)} />
                  <EditSelect value={editing.values.expenseAccountId} options={expenseAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("expenseAccountId", value)} />
                </div>
              </td>
              <td>
                <div className="inline-stack">
                  <EditInput type="date" value={editing.values.startOn} onChange={(value) => setEditValue("startOn", value)} />
                  <EditInput type="date" value={editing.values.nextDueOn} onChange={(value) => setEditValue("nextDueOn", value)} />
                  <EditInput type="date" value={editing.values.endOn} onChange={(value) => setEditValue("endOn", value)} />
                </div>
              </td>
              <td><EditSelect value={editing.values.active} options={[["true", "Active"], ["false", "Inactive"]]} onChange={(value) => setEditValue("active", value)} /></td>
              <td>
                <div className="inline-stack">
                  <EditInput value={editing.values.reference} placeholder="Reference" onChange={(value) => setEditValue("reference", value)} />
                  <EditInput value={editing.values.notes} placeholder="Notes" onChange={(value) => setEditValue("notes", value)} />
                  <EditActions onSave={() => saveEdit(`/api/subscriptions/${subscription.id}`, "Subscription updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} />
                </div>
              </td>
            </tr>
          ) : (
            <tr key={subscription.id}>
              <td>{subscription.vendor}</td>
              <td>{subscription.description}</td>
              <td className="amount negative">-{money.format(subscription.amount)}</td>
              <td>{frequencyText(subscription)}</td>
              <td>{subscription.nextDueOn}</td>
              <td>{subscription.active ? "Active" : "Inactive"}</td>
              <td><button className="icon-button ghost" type="button" title="Edit subscription" onClick={() => startEdit("subscription", subscription.id, { vendor: subscription.vendor, description: subscription.description, amount: subscription.amount, paymentAccountId: subscription.paymentAccountId, expenseAccountId: subscription.expenseAccountId, frequencyEvery: subscription.frequencyEvery, frequencyUnit: subscription.frequencyUnit, startOn: subscription.startOn, nextDueOn: subscription.nextDueOn, endOn: subscription.endOn || "", reference: subscription.reference || "", notes: subscription.notes || "", active: String(subscription.active) })}><Edit3 size={15} /></button></td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
