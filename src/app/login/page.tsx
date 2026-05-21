"use client";

import { FormEvent, useState } from "react";
import { AudioLines } from "lucide-react";
import { useApp } from "@/components/app-provider";

export default function LoginPage() {
  const { login } = useApp();
  const [email, setEmail] = useState("admin@ak-motion.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-mark large">
            <AudioLines size={24} />
          </div>
          <div>
            <span className="eyebrow">Technikteam</span>
            <h1>AK-Motion</h1>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
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
        </form>

        <div className="demo-note">
          <strong>Demo-Zugang</strong>
          <span>Admin: admin@ak-motion.local / admin123</span>
          <span>Techniker: mara@ak-motion.local / technik123</span>
        </div>
      </section>
    </main>
  );
}
