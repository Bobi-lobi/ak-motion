"use client";

import {
  CalendarDays,
  Check,
  Clock,
  FileText,
  Mail,
  MapPin,
  Tag,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { approveRequest, deleteRequest, rejectRequest } from "@/lib/data-store";
import { formatDateTime, formatTimeRange } from "@/lib/date-utils";
import type { EventRequest, RequestStatus } from "@/lib/types";

const statusLabels: Record<RequestStatus, string> = {
  pending: "Offen",
  approved: "Angenommen",
  rejected: "Abgelehnt"
};

export default function RequestsPage() {
  const { data, refresh } = useApp();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const visibleRequests = useMemo(() => data.requests.filter((request) => request.status !== "approved"), [data.requests]);
  const selectedRequest = data.requests.find((request) => request.id === selectedRequestId) ?? null;

  function approve(requestId: string) {
    approveRequest(requestId);
    setSelectedRequestId(null);
    refresh();
  }

  function reject(requestId: string) {
    rejectRequest(requestId);
    refresh();
  }

  function remove(requestId: string) {
    deleteRequest(requestId);
    if (selectedRequestId === requestId) {
      setSelectedRequestId(null);
    }
    refresh();
  }

  return (
    <RouteGuard adminOnly>
      <AppShell title="Anfragen" eyebrow="QR-Formular">
        <section className="requests-board">
          {visibleRequests.map((request) => (
            <article className="request-card" key={request.id} onClick={() => setSelectedRequestId(request.id)}>
              <div className="request-card-main">
                <div>
                  <span className="request-card-kicker">{formatTimeRange(request.startsAt, request.endsAt)}</span>
                  <h2>{request.title}</h2>
                  <p>
                    <CalendarDays size={15} />
                    {formatDateTime(request.startsAt)} Uhr
                  </p>
                  <p>
                    <MapPin size={15} />
                    {request.location || "Kein Ort angegeben"}
                  </p>
                </div>
                <span className={`pill status-${request.status}`}>{statusLabels[request.status]}</span>
              </div>

              <div className="request-card-meta">
                <span>
                  <UserRound size={15} />
                  {request.contactName}
                </span>
                <span>
                  <Mail size={15} />
                  {request.contactEmail}
                </span>
              </div>

              <p className="request-card-note">{request.notes || "Keine Notizen"}</p>

              <RequestActions
                request={request}
                onApprove={() => approve(request.id)}
                onReject={() => reject(request.id)}
                onDelete={() => remove(request.id)}
              />
            </article>
          ))}
          {!visibleRequests.length ? <p className="empty-state">Keine offenen oder abgelehnten Anfragen.</p> : null}
        </section>

        {selectedRequest ? (
          <RequestPreviewModal
            request={selectedRequest}
            onClose={() => setSelectedRequestId(null)}
            onApprove={() => approve(selectedRequest.id)}
            onReject={() => reject(selectedRequest.id)}
            onDelete={() => remove(selectedRequest.id)}
          />
        ) : null}
      </AppShell>
    </RouteGuard>
  );
}

function RequestActions({
  request,
  onApprove,
  onReject,
  onDelete
}: {
  request: EventRequest;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="request-actions" onClick={(clickEvent) => clickEvent.stopPropagation()}>
      {request.status === "pending" ? (
        <>
          <button className="button primary" type="button" onClick={onApprove}>
            <Check size={16} />
            Annehmen
          </button>
          <button className="button" type="button" onClick={onReject}>
            <X size={16} />
            Ablehnen
          </button>
        </>
      ) : (
        <>
          <button className="button success" type="button" onClick={onApprove}>
            <Check size={16} />
            Doch annehmen
          </button>
          <button className="button danger" type="button" onClick={onDelete}>
            <Trash2 size={16} />
            Löschen
          </button>
        </>
      )}
    </div>
  );
}

function RequestPreviewModal({
  request,
  onClose,
  onApprove,
  onReject,
  onDelete
}: {
  request: EventRequest;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="page-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="page-modal request-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${request.title} ansehen`}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <header className="page-modal-actions">
          <button className="icon-button ghost" type="button" aria-label="Fenster schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="page-modal-inner">
          <span className={`pill status-${request.status}`}>{statusLabels[request.status]}</span>
          <h2 className="request-preview-title">{request.title}</h2>

          <div className="property-grid">
            <PreviewRow icon={<CalendarDays size={18} />} label="Datum">
              {formatDateTime(request.startsAt)} Uhr
            </PreviewRow>
            <PreviewRow icon={<Clock size={18} />} label="Uhrzeit">
              {formatTimeRange(request.startsAt, request.endsAt)}
            </PreviewRow>
            <PreviewRow icon={<MapPin size={18} />} label="Ort">
              {request.location || "Leer"}
            </PreviewRow>
            <PreviewRow icon={<Tag size={18} />} label="Typ">
              {request.eventType || "Leer"}
            </PreviewRow>
            <PreviewRow icon={<UserRound size={18} />} label="Ansprechpartner">
              {request.contactName || "Leer"}
            </PreviewRow>
            <PreviewRow icon={<Mail size={18} />} label="E-Mail">
              {request.contactEmail || "Leer"}
            </PreviewRow>
          </div>

          <section className="request-preview-section">
            <h3>
              <FileText size={17} />
              Hinweise
            </h3>
            <p>{request.notes || "Keine Notizen"}</p>
          </section>

          <section className="request-preview-section">
            <h3>Technik</h3>
            <p>{request.techNeeds || "Keine Angaben"}</p>
          </section>

          <RequestActions request={request} onApprove={onApprove} onReject={onReject} onDelete={onDelete} />
        </div>
      </section>
    </div>
  );
}

function PreviewRow({ children, icon, label }: { children: ReactNode; icon: ReactNode; label: string }) {
  return (
    <div className="property-row">
      <div className="property-label">
        {icon}
        {label}
      </div>
      <div className="property-value request-preview-value">{children}</div>
    </div>
  );
}
