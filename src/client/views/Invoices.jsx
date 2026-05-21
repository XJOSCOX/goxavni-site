import React from "react";
import { CheckCircle, Edit3 } from "lucide-react";
import { api, messageForError, money } from "../api.js";
import { EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";

const statusOptions = [["draft", "Draft"], ["sent", "Sent"], ["paid", "Paid"], ["overdue", "Overdue"], ["void", "Void"]];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function Invoices({ data, customers, assetAccounts, revenueAccounts, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, refreshData, setMessage }) {
  const openTotal = data.invoices
    .filter((invoice) => !["paid", "void"].includes(invoice.status))
    .reduce((total, invoice) => total + Number(invoice.amount || 0), 0);

  async function markPaid(invoice) {
    setMessage("");
    try {
      await api(`/api/invoices/${invoice.id}/mark-paid`, { method: "POST", body: "{}" });
      await refreshData();
    } catch (error) {
      setMessage(messageForError(error));
    }
  }

  return (
    <section className="view">
      <div className="metric-grid compact-metrics">
        <article className="metric"><span>Open invoices</span><strong>{data.invoices.filter((invoice) => !["paid", "void"].includes(invoice.status)).length}</strong></article>
        <article className="metric"><span>Open amount</span><strong>{money.format(openTotal)}</strong></article>
      </div>

      <Panel title="New Invoice">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/invoices", event.currentTarget, "Invoice saved.").catch((error) => setMessage(error.message)); }}>
          <Input name="invoiceNumber" label="Invoice number" required />
          <Select name="customerId" label="Customer" options={customers.map((contact) => [contact.id, contact.name])} required />
          <Input name="issueOn" label="Issue date" type="date" defaultValue={today()} required />
          <Input name="dueOn" label="Due date" type="date" required />
          <Input name="amount" label="Amount" type="number" min="0.01" step="0.01" required />
          <Select name="status" label="Status" options={statusOptions} defaultValue="draft" required />
          <Select name="revenueAccountId" label="Revenue account" options={revenueAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
          <Select name="paymentAccountId" label="Payment account" options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
          <Input className="wide" name="description" label="Description" required />
          <Input name="notes" label="Notes" />
          <div className="form-actions"><button type="submit">Save invoice</button></div>
        </form>
      </Panel>

      <Panel title="Invoices" action={<a className="ghost link-button" href="/api/reports/invoices.csv">Invoices CSV</a>}>
        <Table columns={["Invoice", "Customer", "Due", "Status", "Amount", "Description", "Actions"]} empty="No invoices yet." rows={data.invoices.map((invoice) => {
          const rowEditing = isEditing("invoice", invoice.id);
          return rowEditing ? (
            <tr key={invoice.id}>
              <td><EditInput value={editing.values.invoiceNumber} onChange={(value) => setEditValue("invoiceNumber", value)} /></td>
              <td><EditSelect value={editing.values.customerId} options={customers.map((contact) => [contact.id, contact.name])} onChange={(value) => setEditValue("customerId", value)} /></td>
              <td>
                <div className="inline-stack compact-stack">
                  <EditInput type="date" value={editing.values.issueOn} onChange={(value) => setEditValue("issueOn", value)} />
                  <EditInput type="date" value={editing.values.dueOn} onChange={(value) => setEditValue("dueOn", value)} />
                </div>
              </td>
              <td><EditSelect value={editing.values.status} options={statusOptions} onChange={(value) => setEditValue("status", value)} /></td>
              <td className="amount"><EditInput type="number" min="0.01" step="0.01" value={editing.values.amount} onChange={(value) => setEditValue("amount", value)} /></td>
              <td><EditInput value={editing.values.description} onChange={(value) => setEditValue("description", value)} /></td>
              <td>
                <div className="inline-stack">
                  <EditSelect value={editing.values.revenueAccountId} options={revenueAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("revenueAccountId", value)} />
                  <EditSelect value={editing.values.paymentAccountId} options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("paymentAccountId", value)} />
                  <EditInput value={editing.values.notes} placeholder="Notes" onChange={(value) => setEditValue("notes", value)} />
                  <EditActions onSave={() => saveEdit(`/api/invoices/${invoice.id}`, "Invoice updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} />
                </div>
              </td>
            </tr>
          ) : (
            <tr key={invoice.id}>
              <td>{invoice.invoiceNumber}</td>
              <td>{invoice.customerName}</td>
              <td>{invoice.dueOn}</td>
              <td><span className={`status-pill status-${invoice.status}`}>{invoice.status}</span></td>
              <td className="amount positive">{money.format(invoice.amount)}</td>
              <td>{invoice.description}</td>
              <td>
                <div className="row-actions">
                  <button className="icon-button ghost" type="button" title="Edit invoice" onClick={() => startEdit("invoice", invoice.id, { invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, issueOn: invoice.issueOn, dueOn: invoice.dueOn, status: invoice.status, amount: invoice.amount, revenueAccountId: invoice.revenueAccountId, paymentAccountId: invoice.paymentAccountId, description: invoice.description, notes: invoice.notes || "" })}><Edit3 size={15} /></button>
                  {invoice.status !== "paid" && invoice.status !== "void" && <button className="icon-button ghost" type="button" title="Mark paid" onClick={() => markPaid(invoice)}><CheckCircle size={15} /></button>}
                </div>
              </td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
