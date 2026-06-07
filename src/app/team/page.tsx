"use client";

import { FormEvent, useState } from "react";
import { Check, Plus, Shield, Trash2, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import {
  approveRegistrationRequest,
  createProfile,
  deleteProfile,
  deleteRegistrationRequest,
  rejectRegistrationRequest,
  updateProfileRole
} from "@/lib/data-store";
import type { UserRole } from "@/lib/types";

export default function TeamPage() {
  const { data, refresh, session } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createProfile(name, email);
    setName("");
    setEmail("");
    refresh();
  }

  function handleRoleChange(profileId: string, role: UserRole) {
    updateProfileRole(profileId, role);
    refresh();
  }

  function handleDeleteProfile(profileId: string) {
    deleteProfile(profileId);
    refresh();
  }

  function handleApproveRegistration(requestId: string) {
    approveRegistrationRequest(requestId);
    refresh();
  }

  function handleRejectRegistration(requestId: string) {
    rejectRegistrationRequest(requestId);
    refresh();
  }

  function handleDeleteRegistration(requestId: string) {
    deleteRegistrationRequest(requestId);
    refresh();
  }

  return (
    <RouteGuard adminOnly>
      <AppShell title="Techniker" eyebrow="Teamverwaltung">
        <section className="two-column">
          <form className="panel form-stack" onSubmit={handleCreate}>
            <h2>Techniker anlegen</h2>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              E-Mail
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <button className="button primary" type="submit">
              <Plus size={16} />
              Konto vorbereiten
            </button>
            <p className="muted">
              Im Demo-Modus wird nur das Profil angelegt. Mit Supabase erstellt der Admin später den echten Auth-Account.
            </p>
          </form>

          <section className="panel">
            <h2>Bewerbungen</h2>
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
                <p className="muted">Keine offenen Bewerbungen.</p>
              )}
            </div>
          </section>

          <section className="panel team-panel-wide">
            <h2>Team</h2>
            <div className="team-list">
              {data.profiles.map((profile) => (
                <article className="team-row" key={profile.id}>
                  <div className="avatar">
                    {profile.role === "admin" ? <Shield size={18} /> : <UserRound size={18} />}
                  </div>
                  <div>
                    <strong>{profile.name}</strong>
                    <span>{profile.email}</span>
                  </div>
                  <div className="team-actions">
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
                </article>
              ))}
            </div>
          </section>
        </section>
      </AppShell>
    </RouteGuard>
  );
}
