import React, { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-view error-view">
          <section className="workspace">
            <div className="error-panel">
              <h1>Something broke on this page.</h1>
              <p>Please refresh the app and try again. If it keeps happening, the browser console will have the technical detail.</p>
              <button type="button" onClick={() => window.location.reload()}>Refresh</button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function textFromNode(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join(" ");
  if (React.isValidElement(node)) return textFromNode(node.props.children);
  return "";
}

export function Table({ columns, rows, empty }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const searchable = rows.length > 6;
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => textFromNode(row).toLowerCase().includes(needle));
  }, [query, rows]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, rows.length]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <>
      {searchable && (
        <div className="table-tools">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search table" aria-label="Search table" />
          <span>{filteredRows.length} of {rows.length}</span>
        </div>
      )}
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
            {visibleRows.length ? visibleRows : (
              <tr><td className="empty" colSpan={columns.length}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {filteredRows.length > pageSize && (
        <div className="table-pager">
          <button className="ghost" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {page} of {pageCount}</span>
          <button className="ghost" type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
        </div>
      )}
    </>
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
