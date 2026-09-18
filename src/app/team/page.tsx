"use client";

import { useState } from "react";
import { Check, Gift, Shield, Trash2, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import {
  approveRegistrationRequest,
  deleteProfile,
  deleteRegistrationRequest,
  grantXp,
  rejectRegistrationRequest,
  updateProfileRole
} from "@/lib/data-store";
import { isPlaceholderProfile } from "@/lib/gamification";
import type { UserRole } from "@/lib/types";

export default function TeamPage() {
  const { data, refresh, session } = useApp();
  const [actionError, setActionError] = useState("");
  const [xpProfileId, setXpProfileId] = useState<string | null>(null);
  const [xpAmount, setXpAmount] = useState("25");
  const [xpReason, setXpReason] = useState("");
  const visibleProfiles = data.profiles.filter((profile) => !isPlaceholderProfile(profile));

  async function handleRoleChange(profileId: string, role: UserRole) {
    await updateProfileRole(profileId, role);
    refresh();
  }

  async function handleDeleteProfile(profileId: string) {
    await deleteProfile(profileId);
    refresh();
  }

  async function handleApproveRegistration(requestId: string) {
    setActionError("");
    try {
      await approveRegistrationRequest(requestId);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bewerbung konnte nicht angenommen werden.");
    }
  }

  async function handleRejectRegistration(requestId: string) {
    await rejectRegistrationRequest(requestId);
    refresh();
  }

  async function handleDeleteRegistration(requestId: string) {
    await deleteRegistrationRequest(requestId);
    refresh();
  }

  async function handleGrantXp() {
    if (!session || !xpProfileId || !xpReason.trim() || Number(xpAmount) <= 0) return;
    setActionError("");
    try {
      await grantXp(xpProfileId, Number(xpAmount), xpReason, session.id);
      setXpProfileId(null);
      setXpReason("");
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "XP konnten nicht vergeben werden.");
    }
  }

  return (
    <RouteGuard adminOnly>
      <AppShell title="Techniker" eyebrow="Teamverwaltung">
        <section className="team-admin-grid">
          <section className="panel team-admin-card team-applications-card">
            <div>
              <span className="eyebrow">Freischaltung</span>
              <h2>Bewerbungen</h2>
              <p>Neue Mitglieder werden hier geprüft und erst danach für die App freigeschaltet.</p>
            </div>
            {actionError ? <p className="error-text">{actionError}</p> : null}
            <div className="team-list">
              {data.registrationRequests.length ? (
                data.registrationRequests.map((request) => (
                  <article className="team-row registration-row" key={request.id}>
                    <div className="avatar">
                      <UserRound size={18} />
                    </div>
                    <div>
                      <strong>{request.name}</strong>
                      <span>{request.email}</span>
                      {request.phone ? <span>{request.phone}</span> : null}
                      <p>{request.motivation}</p>
                    </div>
                    <div className="team-actions">
                      {request.status === "pending" ? (
                        <>
                          <button className="icon-button success" type="button" aria-label="Bewerbung annehmen" onClick={() => handleApproveRegistration(request.id)}>
                            <Check size={16} />
                          </button>
                          <button className="icon-button danger" type="button" aria-label="Bewerbung ablehnen" onClick={() => handleRejectRegistration(request.id)}>
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="pill">{request.status === "approved" ? "Angenommen" : "Abgelehnt"}</span>
                      )}
                      <button className="icon-button danger" type="button" aria-label="Bewerbung löschen" onClick={() => handleDeleteRegistration(request.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state compact">
                  <UserRound size={22} />
                  <strong>Keine offenen Bewerbungen</strong>
                  <span>Wenn sich jemand registriert, erscheint die Anfrage hier.</span>
                </div>
              )}
            </div>
          </section>

          <section className="panel team-admin-card team-panel-wide">
            <div className="team-panel-head">
              <div>
                <span className="eyebrow">Zugänge</span>
                <h2>Team</h2>
              </div>
              <span className="pill">{visibleProfiles.length} Mitglieder</span>
            </div>
            <div className="team-list">
              {visibleProfiles.map((profile) => (
                <article className="team-row" key={profile.id}>
                  <div className="avatar">
                    {profile.role === "admin" ? <Shield size={18} /> : <UserRound size={18} />}
                  </div>
                  <div>
                    <strong>{profile.name}</strong>
                    <span>{profile.email}</span>
                  </div>
                  <div className="team-actions">
                    <button className="icon-button" type="button" aria-label={`${profile.name} XP geben`} title="XP geben" onClick={() => setXpProfileId(profile.id)}>
                      <Gift size={16} />
                    </button>
                    <select
                      aria-label={`${profile.name} Rolle ändern`}
                      disabled={profile.id === session?.id}
                      value={profile.role}
                      onChange={(event) => handleRoleChange(profile.id, event.target.value as UserRole)}
                    >
                      <option value="technician">Techniker</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label={`${profile.name} entfernen`}
                      disabled={profile.id === session?.id}
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {xpProfileId === profile.id ? (
                    <div className="xp-award-editor">
                      <input type="number" min="1" max="10000" value={xpAmount} onChange={(event) => setXpAmount(event.target.value)} aria-label="XP" />
                      <input value={xpReason} onChange={(event) => setXpReason(event.target.value)} placeholder="Grund, z. B. Aufräumen" autoFocus />
                      <button className="button primary" type="button" disabled={!xpReason.trim() || Number(xpAmount) <= 0} onClick={handleGrantXp}>Vergeben</button>
                      <button className="icon-button" type="button" aria-label="Abbrechen" onClick={() => setXpProfileId(null)}><X size={16} /></button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </section>
      </AppShell>
    </RouteGuard>
  );
}
