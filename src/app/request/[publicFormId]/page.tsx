"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createPublicRequest } from "@/lib/data-store";
import type { AttachmentFile, EventRequestInput } from "@/lib/types";

const eventTypeOptions = ["Schulische Veranstaltung", "Probe", "Feier", "Vortrag", "Aufführung", "Konzert", "Sonstiges"];

const initialForm: EventRequestInput = {
  title: "",
  startsAt: "",
  endsAt: "",
  location: "",
  contactName: "",
  contactEmail: "",
  eventType: "",
  techNeeds: "",
  notes: "",
  presentationFiles: []
};

export default function PublicRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof EventRequestInput>(key: K, value: EventRequestInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setError("Bitte gib gültige Start- und Endzeiten ein.");
      return;
    }

    await createPublicRequest({
      ...form,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString()
    });
    setSubmitted(true);
    setForm(initialForm);
  }

  async function readPresentationFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) {
      return;
    }

    const attachments = await Promise.all(
      files.map(
        (file) =>
          new Promise<AttachmentFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type, url: String(reader.result ?? "") });
            reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
            reader.readAsDataURL(file);
          })
      )
    );
    update("presentationFiles", [...(form.presentationFiles ?? []), ...attachments]);
  }

  function removePresentationFile(index: number) {
    update("presentationFiles", (form.presentationFiles ?? []).filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <main className="public-request">
      <section className="public-panel">
        <div className="public-header">
          <span className="eyebrow">AK-Technik Anfrage</span>
          <h1>Veranstaltung einreichen</h1>
          <p>Beschreibe kurz deine Veranstaltung. Die Teamleitung prüft die Anfrage und meldet sich bei Rückfragen.</p>
        </div>

        {submitted ? (
          <div className="success-box">
            <CheckCircle2 size={28} />
            <strong>Anfrage gesendet</strong>
            <span>Danke. Das Technikteam prüft die Daten und meldet sich bei Rückfragen.</span>
            <button className="button" type="button" onClick={() => setSubmitted(false)}>
              Weitere Anfrage
            </button>
          </div>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Veranstaltungstitel
              <input value={form.title} onChange={(event) => update("title", event.target.value)} required />
            </label>
            <label>
              Ort
              <input value={form.location} onChange={(event) => update("location", event.target.value)} required />
            </label>
            <label>
              Beginn
              <input
                value={form.startsAt}
                onChange={(event) => update("startsAt", event.target.value)}
                type="datetime-local"
                required
              />
            </label>
            <label>
              Ende
              <input
                value={form.endsAt}
                onChange={(event) => update("endsAt", event.target.value)}
                type="datetime-local"
                required
              />
            </label>
            <label>
              Kontaktperson
              <input value={form.contactName} onChange={(event) => update("contactName", event.target.value)} required />
            </label>
            <label>
              Kontakt-E-Mail
              <input
                value={form.contactEmail}
                onChange={(event) => update("contactEmail", event.target.value)}
                type="email"
                required
              />
            </label>
            <label>
              Veranstaltungsart
              <select value={form.eventType} onChange={(event) => update("eventType", event.target.value)} required>
                <option value="">Bitte auswählen</option>
                {eventTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Benötigte Technik <span className="optional-label">optional</span>
              <textarea value={form.techNeeds} onChange={(event) => update("techNeeds", event.target.value)} placeholder="Falls du schon weißt, was gebraucht wird." />
            </label>
            <label className="wide">
              Präsentation <span className="optional-label">optional</span>
              <input
                type="file"
                accept=".pdf,.ppt,.pptx,.key,.odp,image/*"
                multiple
                onChange={(event) => void readPresentationFiles(event.target.files)}
              />
              {form.presentationFiles?.length ? (
                <div className="attachment-list">
                  {form.presentationFiles.map((file, index) => (
                    <span key={`${file.name}-${index}`}>
                      {file.name}
                      <button type="button" onClick={() => removePresentationFile(index)} aria-label={`${file.name} entfernen`}>
                        entfernen
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="wide">
              Weitere Hinweise
              <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} />
            </label>
            {error ? <p className="error-text wide">{error}</p> : null}
            <button className="button primary full wide" type="submit">
              Anfrage absenden
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
