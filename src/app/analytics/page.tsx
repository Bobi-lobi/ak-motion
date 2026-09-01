"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { SchoolYearSelect } from "@/components/school-year-select";
import { useApp } from "@/components/app-provider";
import { isDateInSchoolYear, monthInBerlin, schoolYearForDate, schoolYearMonths, schoolYearOptions } from "@/lib/school-year";
import { isPlaceholderProfile } from "@/lib/gamification";

const axisStyle = { fill: "#a9a9a3", fontSize: 12 };
const tooltipStyle = {
  background: "#2b2b2b",
  border: "1px solid #464646",
  borderRadius: 8,
  color: "#eeeeec"
};

export default function AnalyticsPage() {
  const { data } = useApp();
  const [schoolYear, setSchoolYear] = useState(() => schoolYearForDate());

  const schoolYears = useMemo(() => schoolYearOptions(data.events), [data.events]);
  const countedEvents = useMemo(
    () =>
      data.events.filter(
        (event) =>
          event.eventType.trim().toLowerCase() !== "termin" &&
          event.status === "Abgeschlossen" &&
          isDateInSchoolYear(event.startsAt, schoolYear)
      ),
    [data.events, schoolYear]
  );
  const countedEventById = useMemo(() => new Map(countedEvents.map((event) => [event.id, event])), [countedEvents]);

  const technicianStats = useMemo(
    () =>
      data.profiles
        .filter(
          (profile) =>
            (profile.role === "technician" || profile.role === "admin") && !isPlaceholderProfile(profile)
        )
        .map((profile) => ({
          name: profile.name,
          einsaetze: new Set(
            data.assignments
              .filter((assignment) => {
                const event = countedEventById.get(assignment.eventId);
                return assignment.profileId === profile.id && event?.eventType.trim().toLowerCase() !== "probe";
              })
              .map((assignment) => assignment.eventId)
          ).size
        }))
        .sort((a, b) => b.einsaetze - a.einsaetze),
    [countedEventById, data.assignments, data.profiles]
  );

  const eventStats = useMemo(
    () =>
      schoolYearMonths.map(({ label, month }) => ({
        monat: label,
        veranstaltungen: countedEvents.filter((event) => monthInBerlin(event.startsAt) === month).length
      })),
    [countedEvents]
  );

  return (
    <RouteGuard>
      <AppShell title="Statistik" eyebrow="Schuljahresauswertung">
        <section className="toolbar">
          <SchoolYearSelect value={schoolYear} options={schoolYears} onChange={setSchoolYear} />
        </section>

        <section className="analytics-grid">
          <article className="panel chart-panel">
            <h2>Betreute Veranstaltungen pro Techniker</h2>
            <ResponsiveContainer width="100%" height={Math.max(280, technicianStats.length * 36)}>
              <BarChart data={technicianStats} layout="vertical" margin={{ left: 18, right: 20 }}>
                <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  allowDecimals={false}
                  type="number"
                  domain={[0, (dataMax: number) => Math.max(3, dataMax)]}
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={{ stroke: "#464646" }}
                />
                <YAxis dataKey="name" type="category" width={140} interval={0} tick={axisStyle} tickLine={false} axisLine={{ stroke: "#464646" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(91, 140, 255, 0.08)" }} />
                <ReferenceLine
                  x={3}
                  stroke="#f0b35a"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{ value: "Zertifikat + Pizza", position: "insideTopRight", fill: "#f0b35a", fontSize: 11 }}
                />
                <Bar dataKey="einsaetze" fill="#5b8cff" radius={[0, 6, 6, 0]} />
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
          <p>Ab drei betreuten Veranstaltungen im Schuljahr gibt es ein Zertifikat und Pizza. Termine und Proben zählen dafür nicht.</p>
        </aside>
      </AppShell>
    </RouteGuard>
  );
}
