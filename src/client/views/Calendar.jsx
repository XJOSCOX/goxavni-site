import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, money } from "../api.js";
import { Input, Panel, Table } from "../components.jsx";

export function Calendar({ data, setData, setMessage }) {
  const [range, setRange] = useState({
    from: data.calendar.from || "",
    to: data.calendar.to || ""
  });
  const groups = data.calendar.events.reduce((map, event) => {
    const list = map.get(event.date) || [];
    list.push(event);
    map.set(event.date, list);
    return map;
  }, new Map());

  async function loadCalendar(event) {
    event.preventDefault();
    setMessage("");
    const params = new URLSearchParams(range);
    const result = await api(`/api/calendar?${params.toString()}`);
    setData((current) => ({ ...current, calendar: result.calendar }));
  }

  return (
    <section className="view">
      <Panel title="Calendar Range">
        <form className="form-grid compact" onSubmit={(event) => loadCalendar(event).catch((error) => setMessage(error.message))}>
          <Input name="from" label="From" type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
          <Input name="to" label="To" type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
          <div className="form-actions"><button type="submit"><RefreshCw size={16} /> Refresh</button></div>
        </form>
      </Panel>

      <Panel title="Calendar">
        <div className="calendar-board">
          {[...groups.entries()].length ? [...groups.entries()].map(([date, events]) => (
            <article className="calendar-day" key={date}>
              <header>{date}</header>
              <div>
                {events.map((event) => (
                  <span className={`calendar-event event-${event.type.replaceAll(" ", "-")}`} key={event.id}>
                    {event.time ? `${event.time} ` : ""}{event.title}
                  </span>
                ))}
              </div>
            </article>
          )) : <p className="empty smart-empty">No events in this range.</p>}
        </div>
      </Panel>

      <Panel title="Event List">
        <Table columns={["Date", "Time", "Type", "Title", "Detail", "Amount", "Status"]} empty="No events in this range." rows={data.calendar.events.map((event) => (
          <tr key={event.id}>
            <td>{event.date}</td>
            <td>{event.time || ""}</td>
            <td><span className={`status-pill event-${event.type.replaceAll(" ", "-")}`}>{event.type}</span></td>
            <td>{event.title}</td>
            <td>{event.detail || ""}</td>
            <td className="amount">{event.amount ? money.format(event.amount) : ""}</td>
            <td>{event.status || ""}</td>
          </tr>
        ))} />
      </Panel>
    </section>
  );
}
