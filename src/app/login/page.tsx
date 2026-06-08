"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AudioLines, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Lightbulb, Sparkles, UsersRound, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { createRegistrationRequest } from "@/lib/data-store";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type { LandingImpression } from "@/lib/types";

type AuthPanel = "landing" | "login" | "register";

export default function LoginPage() {
  const { data, login } = useApp();
  const [panel, setPanel] = useState<AuthPanel>(() => initialPanel());
  const [selectedImpression, setSelectedImpression] = useState<LandingImpression | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [equipmentStats, setEquipmentStats] = useState({ lamps: 64, items: 0 });
  const [statsVisible, setStatsVisible] = useState(false);
  const [visibleStats, setVisibleStats] = useState([0, 0, 0, 0]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const landing = data.landingContent;
  const selectedImages = selectedImpression?.images.filter(Boolean) ?? [];

  useEffect(() => {
    async function readEquipmentStats() {
      if (hasSupabaseConfig && supabase) {
        const { data: rows } = await supabase.from("equipment_items").select("name, amount, type");
        const equipmentRows = rows ?? [];
        const lamps = equipmentRows.reduce((sum, row) => {
          const type = row.type?.toLowerCase() ?? "";
          const name = row.name?.toLowerCase() ?? "";
          const amount = Number(row.amount ?? 1) || 1;
          return type.includes("licht") || name.includes("lampe") || name.includes("spot") ? sum + amount : sum;
        }, 0);
        setEquipmentStats({ items: equipmentRows.length, lamps: lamps || 64 });
        return;
      }

      const raw = window.localStorage.getItem("ak-motion-equipment-database");
      if (!raw) {
        return;
      }

      try {
        const equipment = JSON.parse(raw) as { rows?: Array<{ cells?: Record<string, string> }> };
        const rows = equipment.rows ?? [];
        const lamps = rows.reduce((sum, row) => {
          const type = row.cells?.type?.toLowerCase() ?? "";
          const name = row.cells?.name?.toLowerCase() ?? "";
          const amount = Number(row.cells?.amount ?? 1) || 1;
          return type.includes("licht") || name.includes("lampe") || name.includes("spot") ? sum + amount : sum;
        }, 0);
        setEquipmentStats({ items: rows.length, lamps: lamps || 64 });
      } catch {
        setEquipmentStats({ items: 0, lamps: 64 });
      }
    }

    void readEquipmentStats();
    const handleStorage = () => void readEquipmentStats();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("ak-motion-equipment", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("ak-motion-equipment", handleStorage);
    };
  }, []);

  const stats = useMemo(
    () =>
      landing.stats.map((stat) => ({
        ...stat,
        value:
          stat.id === "events"
            ? data.events.length
            : stat.id === "lamps"
              ? equipmentStats.lamps
              : stat.id === "technicians"
                ? data.profiles.length
                : Math.max(equipmentStats.items, 1),
        icon: stat.id === "events" ? CalendarDays : stat.id === "lamps" ? Lightbulb : stat.id === "technicians" ? UsersRound : Sparkles
      })),
    [data.events.length, data.profiles.length, equipmentStats.items, equipmentStats.lamps, landing.stats]
  );

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".landing-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.18 }
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [panel]);

  useEffect(() => {
    const target = document.querySelector(".landing-stats");
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [panel]);

  useEffect(() => {
    if (!statsVisible) {
      setVisibleStats([0, 0, 0, 0]);
      return;
    }

    let frame = 0;
    const duration = 1000;
    const startedAt = performance.now();
    const targets = stats.map((stat) => stat.value);

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVisibleStats(targets.map((value) => Math.round(value * eased)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stats, statsVisible]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await createRegistrationRequest({
        name: registerName,
        email: registerEmail,
        phone: registerPhone,
        password: registerPassword,
        motivation: ""
      });
      setSuccess("Deine Bewerbung ist angekommen. Die Teamleitung kann dich jetzt freischalten.");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPhone("");
      setRegisterPassword("");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Registrierung fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  if (panel === "login" || panel === "register") {
    return (
      <main className="login-screen auth-only-screen">
        <section className="login-panel">
          <div className="login-brand">
            <div className="brand-mark large">
              <AudioLines size={24} />
            </div>
            <div>
              <span className="eyebrow">AK-Technik</span>
              <h1>Motion</h1>
            </div>
          </div>
          {panel === "login" ? (
            <form className="form-stack" onSubmit={handleLogin}>
              <label>
                E-Mail
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
              </label>
              <label>
                Passwort
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
              </label>
              {error ? <p className="error-text">{error}</p> : null}
              <button className="button primary full" type="submit" disabled={pending}>
                {pending ? "Melde an..." : "Einloggen"}
              </button>
              <p className="auth-switch-text">
                Noch nicht im Team?{" "}
                <button type="button" onClick={() => setPanel("register")}>
                  Mitglied werden
                </button>
              </p>
            </form>
          ) : (
            <form className="form-stack" onSubmit={handleRegister}>
              <label>
                Name
                <input value={registerName} onChange={(event) => setRegisterName(event.target.value)} required />
              </label>
              <label>
                E-Mail
                <input value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} type="email" required />
              </label>
              <label>
                Telefonnummer <span className="optional-label">(optional)</span>
                <input value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} inputMode="tel" />
              </label>
              <label>
                Passwort
                <input value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} minLength={6} type="password" required />
              </label>
              {error ? <p className="error-text">{error}</p> : null}
              {success ? <p className="success-text">{success}</p> : null}
              <button className="button primary full" type="submit" disabled={pending}>
                {pending ? "Sendet..." : "Bewerbung abschicken"}
              </button>
              <p className="auth-switch-text">
                Schon freigeschaltet?{" "}
                <button type="button" onClick={() => setPanel("login")}>
                  Einloggen
                </button>
              </p>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="landing-screen">
      <nav className="landing-nav" aria-label="Startseite">
        <div className="login-brand">
          <div className="brand-mark">
            <AudioLines size={18} />
          </div>
          <strong>{landing.brandTitle}</strong>
        </div>
        <div>
          <a className="landing-login-link" href="/login?panel=login">
            Login
          </a>
        </div>
      </nav>

      <section className="landing-hero landing-reveal is-visible">
        <div className="landing-copy">
          <span className="landing-kicker" dangerouslySetInnerHTML={{ __html: landing.heroKicker }} />
          <h2 dangerouslySetInnerHTML={{ __html: landing.heroTitle }} />
          <p dangerouslySetInnerHTML={{ __html: landing.heroText }} />
          <div className="landing-actions">
            <a
              className="button primary landing-member-button"
              href="#join"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById("join")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span dangerouslySetInnerHTML={{ __html: landing.primaryButtonText }} />
            </a>
            <a className="button landing-request-button" href="/request/motion">
              <span dangerouslySetInnerHTML={{ __html: landing.requestButtonText }} />
            </a>
          </div>
        </div>

        <div className="landing-gallery" aria-label="Veranstaltungsbilder">
          {landing.eventImages.map((image, index) => (
            <img alt="Motion Veranstaltung" key={image} src={image} className={index === 0 ? "is-featured" : ""} />
          ))}
        </div>
      </section>

      <section className="landing-stats landing-reveal" id="stats" aria-label="Motion Zahlen">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label}>
              <Icon size={20} />
              <strong>
                {(statsVisible ? visibleStats[index] : stat.value) ?? stat.value}
                {stat.suffix}
              </strong>
              <span>{stat.label}</span>
            </article>
          );
        })}
      </section>

      <section className="landing-impressions landing-reveal">
        <div className="landing-section-head">
          <span className="eyebrow" dangerouslySetInnerHTML={{ __html: landing.impressionsKicker }} />
          <h2 dangerouslySetInnerHTML={{ __html: landing.impressionsTitle }} />
        </div>
        <div className="impression-grid">
          {landing.impressions.map((impression) => (
            <button
              className="impression-card"
              key={impression.id}
              type="button"
              onClick={() => {
                setSelectedImageIndex(0);
                setSelectedImpression(impression);
              }}
            >
              <img alt={impression.title} src={impression.images[0]} />
              <span>{impression.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="landing-team landing-reveal" id="team">
        <div className="landing-section-head">
          <span className="eyebrow" dangerouslySetInnerHTML={{ __html: landing.teamKicker }} />
          <h2 dangerouslySetInnerHTML={{ __html: landing.teamTitle }} />
        </div>
        <div className="team-portrait-card">
          <img alt="Technikteam bei einer Veranstaltung" src={landing.teamImage} />
          <div>
            {landing.teamNames.map((name) => (
              <span key={name}>
                <strong>{name}</strong>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-request-section landing-reveal">
        <article className="landing-request-card">
          <div>
            <ClipboardList size={24} />
            <span className="eyebrow" dangerouslySetInnerHTML={{ __html: landing.requestKicker }} />
            <h2 dangerouslySetInnerHTML={{ __html: landing.requestTitle }} />
            <p dangerouslySetInnerHTML={{ __html: landing.requestText }} />
          </div>
          <a className="button primary landing-member-button" href="/request/motion">
            <span dangerouslySetInnerHTML={{ __html: landing.requestCta }} />
          </a>
        </article>
      </section>

      <section className="landing-bottom landing-reveal" id="join">
        <article className="join-card">
          <h2 dangerouslySetInnerHTML={{ __html: landing.joinTitle }} />
          <p dangerouslySetInnerHTML={{ __html: landing.joinText }} />
        </article>
      </section>

      {selectedImpression ? (
        <div className="page-modal-backdrop impression-modal-backdrop" role="presentation" onClick={() => setSelectedImpression(null)}>
          <section className="impression-modal" role="dialog" aria-modal="true" aria-label={selectedImpression.title} onClick={(event) => event.stopPropagation()}>
            <button className="icon-button ghost impression-close" type="button" aria-label="Schließen" onClick={() => setSelectedImpression(null)}>
              <X size={18} />
            </button>
            <div className="impression-slideshow">
              <div className="impression-slide-frame">
                <img alt={selectedImpression.title} src={selectedImages[selectedImageIndex] ?? selectedImages[0]} />
                {selectedImages.length > 1 ? (
                  <>
                    <button
                      className="impression-arrow is-left"
                      type="button"
                      aria-label="Vorheriges Bild"
                      onClick={() => setSelectedImageIndex((current) => (current - 1 + selectedImages.length) % selectedImages.length)}
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      className="impression-arrow is-right"
                      type="button"
                      aria-label="Nächstes Bild"
                      onClick={() => setSelectedImageIndex((current) => (current + 1) % selectedImages.length)}
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                ) : null}
              </div>
              {selectedImages.length > 1 ? (
                <div className="impression-slideshow-controls" aria-label="Bilder auswählen">
                  {selectedImages.map((image, index) => (
                    <button
                      className={index === selectedImageIndex ? "is-active" : ""}
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      aria-label={`Bild ${index + 1} anzeigen`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="impression-modal-text">
              <span className="eyebrow">Eindruck</span>
              <h2>{selectedImpression.title}</h2>
              <p>{selectedImpression.text}</p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function initialPanel(): AuthPanel {
  if (typeof window === "undefined") {
    return "landing";
  }

  const panel = new URLSearchParams(window.location.search).get("panel");
  const next = new URLSearchParams(window.location.search).get("next");
  if (panel === "login" || panel === "register") {
    return panel;
  }
  return next ? "login" : "landing";
}
