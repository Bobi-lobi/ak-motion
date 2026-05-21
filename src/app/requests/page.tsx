"use client";

import { Check, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { approveRequest, rejectRequest } from "@/lib/data-store";
import { formatDateTime } from "@/lib/date-utils";

export default function RequestsPage() {
  const { data, refresh } = useApp();
  const requests = data.requests;

  return (
    <RouteGuard adminOnly>
      <AppShell title="Anfragen" eyebrow="QR-Formular">
        <section className="stack">
          {requests.map((request) => (
            <article className="event-card" key={request.id}>
              <div className="event-card-header">
                <div>
                  <h2>{request.title}</h2>
                  <p>{formatDateTime(request.startsAt)} Uhr in {request.location}</p>
                  <p>{request.contactName} · {request.contactEmail}</p>
                </div>
                <span className={`pill status-${request.status}`}>{request.status}</span>
              </div>
              <dl className="meta-grid">
                <div>
                  <dt>Technik</dt>
                  <dd>{request.techNeeds}</dd>
                </div>
                <div>
                  <dt>Notizen</dt>
                  <dd>{request.notes || "Keine Notizen"}</dd>
                </div>
              </dl>
              {request.status === "pending" ? (
                <div className="button-row">
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => {
                      approveRequest(request.id);
                      refresh();
                    }}
                  >
                    <Check size={16} />
                    In Kalender übernehmen
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      rejectRequest(request.id);
                      refresh();
                    }}
                  >
                    <X size={16} />
                    Ablehnen
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!requests.length ? <p className="empty-state">Noch keine externen Anfragen.</p> : null}
        </section>
      </AppShell>
    </RouteGuard>
  );
}
