import React from "react";
import { Edit3 } from "lucide-react";
import { DeleteButton, EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";
import { money } from "../api.js";

export function Payments({ data, activeMembers, assetAccounts, expenseAccounts, canOwn, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, deleteRecord, submit, setMessage }) {
  return (
    <section className="view">
      <Panel title="Pay Member" action={!canOwn && <span className="role-note">Only owners can record payments</span>}>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/member-payments", event.currentTarget, "Member payment recorded.").catch((error) => setMessage(error.message)); }}>
          <Select name="memberId" label="Member" options={activeMembers.map((member) => [member.id, member.name])} required />
          <Input name="paidOn" label="Paid on" type="date" required />
          <Input name="amount" label="Amount" type="number" min="0.01" step="0.01" required />
          <Select name="paymentAccountId" label="Payment account" options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
          <Select name="expenseAccountId" label="Expense account" options={expenseAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
          <Input name="reference" label="Reference" />
          <Input name="periodStart" label="Period start" type="date" />
          <Input name="periodEnd" label="Period end" type="date" />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions wide"><button type="submit" disabled={!canOwn}>Record payment</button></div>
        </form>
      </Panel>

      <Panel title="Member Payments">
        <Table columns={["Date", "Member", "Reference", "Amount", "Actions"]} empty="No member payments yet." rows={data.payments.map((payment) => {
          const rowEditing = isEditing("payment", payment.id);
          return rowEditing ? (
            <tr key={payment.id}>
              <td><EditInput type="date" value={editing.values.paidOn} onChange={(value) => setEditValue("paidOn", value)} /></td>
              <td><EditSelect value={editing.values.memberId} options={activeMembers.map((member) => [member.id, member.name])} onChange={(value) => setEditValue("memberId", value)} /></td>
              <td><EditInput value={editing.values.reference} onChange={(value) => setEditValue("reference", value)} /></td>
              <td className="amount"><EditInput type="number" min="0.01" step="0.01" value={editing.values.amount} onChange={(value) => setEditValue("amount", value)} /></td>
              <td>
                <div className="inline-stack">
                  <EditSelect value={editing.values.paymentAccountId} options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("paymentAccountId", value)} />
                  <EditSelect value={editing.values.expenseAccountId} options={expenseAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("expenseAccountId", value)} />
                  <EditInput type="date" value={editing.values.periodStart} onChange={(value) => setEditValue("periodStart", value)} />
                  <EditInput type="date" value={editing.values.periodEnd} onChange={(value) => setEditValue("periodEnd", value)} />
                  <EditInput value={editing.values.notes} placeholder="Notes" onChange={(value) => setEditValue("notes", value)} />
                  <EditActions onSave={() => saveEdit(`/api/member-payments/${payment.id}`, "Member payment updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} />
                </div>
              </td>
            </tr>
          ) : (
            <tr key={payment.id}>
              <td>{payment.paidOn}</td>
              <td>{payment.memberName}</td>
              <td>{payment.reference || ""}</td>
              <td className="amount negative">-{money.format(payment.amount)}</td>
              <td>{canOwn && <div className="row-actions"><button className="icon-button ghost" type="button" title="Edit payment" onClick={() => startEdit("payment", payment.id, { memberId: payment.memberId, paidOn: payment.paidOn, amount: payment.amount, paymentAccountId: payment.paymentAccountId, expenseAccountId: payment.expenseAccountId, periodStart: payment.periodStart || "", periodEnd: payment.periodEnd || "", reference: payment.reference || "", notes: payment.notes || "" })}><Edit3 size={15} /></button><DeleteButton title="Delete payment" onDelete={() => deleteRecord(`/api/member-payments/${payment.id}`, "member payment")} /></div>}</td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
