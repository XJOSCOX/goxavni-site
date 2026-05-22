import React from "react";
import { Edit3 } from "lucide-react";
import { CategorySelect, DeleteButton, EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";
import { money, payload } from "../api.js";

export function Transactions({ data, canManage, assetAccounts, revenueAccounts, expenseAccounts, editing, isEditing, setEditing, setEditValue, startEdit, cancelEdit, saveEdit, deleteRecord, submit, setMessage }) {
  return (
    <section className="view">
      <Panel title="New Transaction">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/transactions", event.currentTarget, "Transaction saved.").catch((error) => setMessage(error.message)); }}>
          <Input name="occurredOn" label="Date" type="date" required />
          <Select name="type" label="Type" options={[["income", "Income"], ["expense", "Expense"]]} required />
          <Input name="amount" label="Amount" type="number" min="0.01" step="0.01" required />
          <Input name="party" label="Party" required />
          <Select name="paymentAccountId" label="Payment account" options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} required />
          <CategorySelect income={revenueAccounts} expense={expenseAccounts} />
          <Input className="wide" name="description" label="Description" required />
          <Input name="reference" label="Reference" />
          <div className="form-actions wide"><button type="submit">Save transaction</button></div>
        </form>
      </Panel>
      <Panel title="Ledger">
        <Table columns={["Date", "Party", "Description", "Category", "Amount", "Actions"]} empty="No transactions yet." rows={data.transactions.map((tx) => {
          const rowEditing = isEditing("transaction", tx.id);
          const categoryOptions = editing?.values?.type === "expense" ? expenseAccounts : revenueAccounts;
          return rowEditing ? (
            <tr key={tx.id}>
              <td><EditInput type="date" value={editing.values.occurredOn} onChange={(value) => setEditValue("occurredOn", value)} /></td>
              <td><EditInput value={editing.values.party} onChange={(value) => setEditValue("party", value)} /></td>
              <td><EditInput value={editing.values.description} onChange={(value) => setEditValue("description", value)} /></td>
              <td>
                <div className="inline-stack">
                  <EditSelect value={editing.values.type} options={[["income", "Income"], ["expense", "Expense"]]} onChange={(value) => setEditing((current) => ({ ...current, values: { ...current.values, type: value, categoryAccountId: "" } }))} />
                  <EditSelect value={editing.values.categoryAccountId} options={categoryOptions.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("categoryAccountId", value)} />
                  <EditSelect value={editing.values.paymentAccountId} options={assetAccounts.map((account) => [account.id, `${account.code} - ${account.name}`])} onChange={(value) => setEditValue("paymentAccountId", value)} />
                  <EditInput value={editing.values.reference} placeholder="Reference" onChange={(value) => setEditValue("reference", value)} />
                </div>
              </td>
              <td className="amount"><EditInput type="number" min="0.01" step="0.01" value={editing.values.amount} onChange={(value) => setEditValue("amount", value)} /></td>
              <td><EditActions onSave={() => saveEdit(`/api/transactions/${tx.id}`, "Transaction updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} /></td>
            </tr>
          ) : (
            <tr key={tx.id}>
              <td>{tx.occurredOn}</td><td>{tx.party}</td><td>{tx.description}</td><td>{tx.categoryAccount}</td><td className={`amount ${tx.type === "income" ? "positive" : "negative"}`}>{tx.type === "expense" ? "-" : ""}{money.format(tx.amount)}</td>
              <td>{canManage && <div className="row-actions"><button className="icon-button ghost" type="button" title="Edit transaction" onClick={() => startEdit("transaction", tx.id, { occurredOn: tx.occurredOn, type: tx.type, amount: tx.amount, party: tx.party, description: tx.description, reference: tx.reference || "", paymentAccountId: tx.paymentAccountId, categoryAccountId: tx.categoryAccountId })}><Edit3 size={15} /></button><DeleteButton title="Delete transaction" onDelete={() => deleteRecord(`/api/transactions/${tx.id}`, "transaction")} /></div>}</td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
