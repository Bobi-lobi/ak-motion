"use client";

import { FormEvent, useState } from "react";
import { Plus, Shield, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { createProfile } from "@/lib/data-store";

export default function TeamPage() {
  const { data, refresh } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createProfile(name, email);
    setName("");
    setEmail("");
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
                  <span className="pill">{profile.role === "admin" ? "Admin" : "Techniker"}</span>
                </article>
              ))}
            </div>
          </section>
        </section>
      </AppShell>
    </RouteGuard>
  );
}
