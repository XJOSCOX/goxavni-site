import React, { useEffect, useState } from "react";
import { Save, X } from "lucide-react";

export function Table({ columns, rows, empty }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className={["Amount", "Hours", "Rate"].includes(column) ? "amount" : ""}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows : (
            <tr><td className="empty" colSpan={columns.length}>{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Metric({ label, value }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

export function Panel({ title, action, children }) {
  return <section className="panel"><div className="panel-title"><h2>{title}</h2>{action}</div>{children}</section>;
}

export function Input({ label, className = "", ...props }) {
  return <label className={className}>{label}<input {...props} /></label>;
}

export function Select({ label, options, className = "", ...props }) {
  return <label className={className}>{label}<select {...props}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

export function EditInput({ value, onChange, ...props }) {
  return <input className="edit-field" value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...props} />;
}

export function EditSelect({ value, options, onChange }) {
  return (
    <select className="edit-field" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
      <option value="" disabled>Choose</option>
      {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
    </select>
  );
}

export function EditActions({ onSave, onCancel }) {
  return (
    <div className="row-actions">
      <button className="icon-button" type="button" title="Save" onClick={onSave}><Save size={15} /></button>
      <button className="icon-button ghost" type="button" title="Cancel" onClick={onCancel}><X size={15} /></button>
    </div>
  );
}

export function CategorySelect({ income, expense }) {
  const [type, setType] = useState("income");
  useEffect(() => {
    const select = document.querySelector('select[name="type"]');
    if (!select) return undefined;
    const listener = () => setType(select.value);
    select.addEventListener("change", listener);
    listener();
    return () => select.removeEventListener("change", listener);
  }, []);
  const options = type === "income" ? income : expense;
  return <Select name="categoryAccountId" label="Category" options={options.map((account) => [account.id, `${account.code} - ${account.name}`])} required />;
}
