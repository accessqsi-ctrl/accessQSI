"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Loader2, Ticket } from "lucide-react";
import BoxShell, { Card, SecureBoxCard } from "../components/BoxShell";
import { attendeeJson } from "../lib/attendeeApi";
import { formatDate, ticketBadge } from "../lib/boxTickets";

export default function BoxPage() {
  return <BoxShell>{({ attendee, setAttendee }) => <TicketList attendee={attendee} setAttendee={setAttendee} />}</BoxShell>;
}

function TicketList({ attendee, setAttendee }) {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    attendeeJson("/box/tickets").then(data => setTickets(data.tickets)).catch(reason => setError(reason.message));
  }, []);

  return <div className="space-y-5">
    {tickets?.length > 0 && <SecureBoxCard attendee={attendee} onSecured={setAttendee} />}
    <Card>
      <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50">Mes billets</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{attendee.fullName} · {attendee.email}</p>
      {error ? <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
        : !tickets ? <div className="py-12 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" /></div>
        : !tickets.length ? <div className="py-12 text-center"><Ticket className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">Votre box est vide.</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Les billets obtenus avec cette adresse apparaîtront ici.</p></div>
        : <ul className="mt-6 divide-y divide-slate-200 dark:divide-slate-800">{tickets.map(ticket => {
          const badge = ticketBadge(ticket);
          return <li key={ticket.id}><a href={`/box/tickets/${encodeURIComponent(ticket.id)}`} className="flex items-center gap-4 py-4 hover:opacity-80">
            <Ticket className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-950 dark:text-slate-50">{ticket.event.title}</p>
              <p className="truncate text-sm text-slate-600 dark:text-slate-300">{ticket.offerName}</p>
              {ticket.event.startsAt && <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(ticket.event.startsAt)}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </a></li>;
        })}</ul>}
    </Card>
  </div>;
}
