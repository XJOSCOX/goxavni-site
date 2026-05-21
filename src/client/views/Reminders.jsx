import React from "react";
import { Edit3 } from "lucide-react";
import { EditActions, EditInput, EditSelect, Input, Panel, Select, Table } from "../components.jsx";

const priorityOptions = [["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]];
const statusOptions = [["open", "Open"], ["done", "Done"]];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function Reminders({ data, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, setMessage }) {
  const open = data.reminders.filter((reminder) => reminder.status === "open");
  const urgent = open.filter((reminder) => reminder.priority === "urgent" || reminder.priority === "high");

  return (
    <section className="view">
      <div className="metric-grid compact-metrics">
        <article className="metric"><span>Open reminders</span><strong>{open.length}</strong></article>
        <article className="metric"><span>High priority</span><strong>{urgent.length}</strong></article>
      </div>

      <Panel title="New Reminder">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit("/api/reminders", event.currentTarget, "Reminder saved.").catch((error) => setMessage(error.message)); }}>
          <Input name="title" label="Title" required />
          <Input name="dueOn" label="Due date" type="date" defaultValue={today()} required />
          <Input name="dueTime" label="Due time" type="time" />
          <Select name="priority" label="Priority" options={priorityOptions} defaultValue="normal" />
          <Input className="wide" name="details" label="Details" />
          <div className="form-actions"><button type="submit">Save reminder</button></div>
        </form>
      </Panel>

      <Panel title="Reminders" action={<a className="ghost link-button" href="/api/reports/reminders.csv">Reminders CSV</a>}>
        <Table columns={["Due", "Title", "Priority", "Status", "Details", "Actions"]} empty="No reminders yet." rows={data.reminders.map((reminder) => {
          const rowEditing = isEditing("reminder", reminder.id);
          return rowEditing ? (
            <tr key={reminder.id}>
              <td>
                <div className="inline-stack compact-stack">
                  <EditInput type="date" value={editing.values.dueOn} onChange={(value) => setEditValue("dueOn", value)} />
                  <EditInput type="time" value={editing.values.dueTime} onChange={(value) => setEditValue("dueTime", value)} />
                </div>
              </td>
              <td><EditInput value={editing.values.title} onChange={(value) => setEditValue("title", value)} /></td>
              <td><EditSelect value={editing.values.priority} options={priorityOptions} onChange={(value) => setEditValue("priority", value)} /></td>
              <td><EditSelect value={editing.values.status} options={statusOptions} onChange={(value) => setEditValue("status", value)} /></td>
              <td><EditInput value={editing.values.details} onChange={(value) => setEditValue("details", value)} /></td>
              <td><EditActions onSave={() => saveEdit(`/api/reminders/${reminder.id}`, "Reminder updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} /></td>
            </tr>
          ) : (
            <tr key={reminder.id}>
              <td>{reminder.dueOn}{reminder.dueTime ? ` ${reminder.dueTime}` : ""}</td>
              <td>{reminder.title}</td>
              <td><span className={`status-pill priority-${reminder.priority}`}>{reminder.priority}</span></td>
              <td><span className={`status-pill status-${reminder.status}`}>{reminder.status}</span></td>
              <td>{reminder.details || ""}</td>
              <td><button className="icon-button ghost" type="button" title="Edit reminder" onClick={() => startEdit("reminder", reminder.id, { title: reminder.title, dueOn: reminder.dueOn, dueTime: reminder.dueTime || "", priority: reminder.priority, status: reminder.status, details: reminder.details || "" })}><Edit3 size={15} /></button></td>
            </tr>
          );
        })} />
      </Panel>
    </section>
  );
}
