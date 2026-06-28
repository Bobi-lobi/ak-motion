"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";

const monthNames = ["Jan", "Feb", "März", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const axisStyle = { fill: "#a9a9a3", fontSize: 12 };
const tooltipStyle = {
  background: "#2b2b2b",
  border: "1px solid #464646",
  borderRadius: 8,
  color: "#eeeeec"
};

export default function AnalyticsPage() {
  const { data } = useApp();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const years = useMemo(() => {
    const allYears = new Set([
      currentYear,
      ...data.events.map((event) => new Date(event.startsAt).getFullYear())
    ]);
    return Array.from(allYears).sort((a, b) => b - a);
  }, [currentYear, data.events]);

  const technicianStats = useMemo(
    () =>
      data.profiles
        .filter((profile) => profile.role === "technician")
        .map((profile) => ({
          name: profile.name,
          einsaetze: data.assignments.filter((assignment) => {
            const event = data.events.find((eventItem) => eventItem.id === assignment.eventId);
            return (
              assignment.profileId === profile.id &&
              event?.status === "Abgeschlossen" &&
              new Date(event.startsAt).getFullYear() === year
            );
          }).length
        })),
    [data.assignments, data.events, data.profiles, year]
  );

  const eventStats = useMemo(
    () =>
      monthNames.map((name, index) => ({
        monat: name,
        veranstaltungen: data.events.filter((event) => {
          const date = new Date(event.startsAt);
          return event.status === "Abgeschlossen" && date.getFullYear() === year && date.getMonth() === index;
        }).length
      })),
    [data.events, year]
  );

  return (
    <RouteGuard>
      <AppShell title="Statistik" eyebrow="Jahresauswertung">
        <section className="toolbar">
          <label className="select-label">
            Jahr
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((yearItem) => (
                <option key={yearItem} value={yearItem}>
                  {yearItem}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="analytics-grid">
          <article className="panel chart-panel">
            <h2>Betreute Veranstaltungen pro Techniker</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={technicianStats}>
                <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#464646" }} />
                <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={{ stroke: "#464646" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(91, 140, 255, 0.08)" }} />
                <Bar dataKey="einsaetze" fill="#5b8cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className="panel chart-panel">
            <h2>Veranstaltungen pro Monat</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={eventStats}>
                <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="monat" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#464646" }} />
                <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={{ stroke: "#464646" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(91, 216, 155, 0.08)" }} />
                <Bar dataKey="veranstaltungen" fill="#5bd89b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        </section>

        <aside className="analytics-info-callout">
          <Lightbulb size={26} />
          <p>Nur wer mehr als zwei Veranstaltungen im Jahr betreut, bekommt am Ende des Jahres ein Zertifikat und darf mit zum Pizza Essen gehen!</p>
        </aside>
      </AppShell>
    </RouteGuard>
  );
}
