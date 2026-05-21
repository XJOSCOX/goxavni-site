import React from "react";
import { Edit3 } from "lucide-react";
import { EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";
import { money } from "../api.js";

export function Timesheets({ data, activeMembers, canManage, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, setMessage }) {
  return (
    <section className="view">
      <Panel title="New Timesheet">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/timesheets", event.currentTarget, "Timesheet saved.").catch((error) => setMessage(error.message)); }}>
          <Select name="memberId" label="Member" options={activeMembers.map((member) => [member.id, member.name])} required />
          <Input name="workDate" label="Date" type="date" required />
          <Input name="hours" label="Hours" type="number" min="0.25" max="24" step="0.25" required />
          <Input name="hourlyRate" label="Hourly rate" type="number" min="0" step="0.01" />
          <Input name="project" label="Project" />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions wide"><button type="submit">Save time</button></div>
        </form>
      </Panel>

      <Panel title="Timesheets">
        <Table columns={["Date", "Member", "Project", "Hours", "Amount", "Status", "Actions"]} empty="No timesheets yet." rows={data.timesheets.map((entry) => {
          const rowEditing = isEditing("timesheet", entry.id);
          return rowEditing ? (
            <tr key={entry.id}>
              <td><EditInput type="date" value={editing.values.workDate} onChange={(value) => setEditValue("workDate", value)} /></td>
              <td><EditSelect value={editing.values.memberId} options={activeMembers.map((member) => [member.id, member.name])} onChange={(value) => setEditValue("memberId", value)} /></td>
              <td><EditInput value={editing.values.project} onChange={(value) => setEditValue("project", value)} /></td>
              <td className="amount"><EditInput type="number" min="0.25" max="24" step="0.25" value={editing.values.hours} onChange={(value) => setEditValue("hours", value)} /></td>
              <td className="amount"><EditInput type="number" min="0" step="0.01" value={editing.values.hourlyRate} onChange={(value) => setEditValue("hourlyRate", value)} /></td>
              <td><EditSelect value={editing.values.status} options={[["submitted", "Submitted"], ["approved", "Approved"], ["paid", "Paid"]]} onChange={(value) => setEditValue("status", value)} /></td>
              <td><EditActions onSave={() => saveEdit(`/api/timesheets/${entry.id}`, "Timesheet updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} /></td>
            </tr>
          ) : (
            <tr key={entry.id}>
              <td>{entry.workDate}</td>
              <td>{entry.memberName}</td>
              <td>{entry.project || ""}</td>
              <td className="amount">{entry.hours}</td>
              <td className="amount">{money.format(entry.amount || 0)}</td>
              <td>{entry.status}</td>
              <td>{canManage && <button className="icon-button ghost" type="button" title="Edit timesheet" onClick={() => startEdit("timesheet", entry.id, { memberId: entry.memberId, workDate: entry.workDate, hours: entry.hours, hourlyRate: entry.hourlyRate || 0, project: entry.project || "", notes: entry.notes || "", status: entry.status })}><Edit3 size={15} /></button>}</td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
