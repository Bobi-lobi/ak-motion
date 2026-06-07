"use client";

import { FormEvent, useEffect, useState } from "react";
import { AudioLines, GalleryVerticalEnd, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { updateLandingContent } from "@/lib/data-store";
import type { LandingContent, LandingImpression } from "@/lib/types";

export default function LandingEditorPage() {
  const { data, refresh } = useApp();
  const [content, setContent] = useState<LandingContent>(data.landingContent);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setContent(data.landingContent);
  }, [data.landingContent]);

  function patchContent(patch: Partial<LandingContent>) {
    setContent((current) => ({ ...current, ...patch }));
  }

  function updateImpression(id: string, patch: Partial<LandingImpression>) {
    patchContent({
      impressions: content.impressions.map((impression) => (impression.id === id ? { ...impression, ...patch } : impression))
    });
  }

  function addImpression() {
    patchContent({
      impressions: [
        ...content.impressions,
        {
          id: `impression-${Date.now()}`,
          title: "Neue Veranstaltung",
          text: "Kurzer Eindruck der Veranstaltung.",
          images: [content.eventImages[0] ?? ""]
        }
      ]
    });
  }

  function deleteImpression(id: string) {
    patchContent({ impressions: content.impressions.filter((impression) => impression.id !== id) });
  }

  function updateHeroImage(index: number, image: string) {
    const next = [...content.eventImages];
    next[index] = image;
    patchContent({ eventImages: next });
  }

  function removeHeroImage(index: number) {
    patchContent({ eventImages: content.eventImages.filter((_, imageIndex) => imageIndex !== index) });
  }

  function updateImpressionImage(impression: LandingImpression, index: number, image: string) {
    const next = [...impression.images];
    next[index] = image;
    updateImpression(impression.id, { images: next });
  }

  function removeImpressionImage(impression: LandingImpression, index: number) {
    updateImpression(impression.id, { images: impression.images.filter((_, imageIndex) => imageIndex !== index) });
  }

  function readImages(fileList: FileList | null, callback: (images: string[]) => void) {
    const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      return;
    }

    Promise.all(files.map((file) => compressImage(file))).then(callback);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      updateLandingContent({
        ...content,
        heroTitle: content.heroTitle.trim(),
        heroText: content.heroText.trim(),
        joinTitle: content.joinTitle.trim(),
        joinText: content.joinText.trim(),
        eventImages: content.eventImages.map((item) => item.trim()).filter(Boolean),
        teamImage: content.teamImage.trim(),
        teamNames: content.teamNames.map((item) => item.trim()).filter(Boolean),
        impressions: content.impressions.map((impression) => ({
          ...impression,
          title: impression.title.trim(),
          text: impression.text.trim(),
          images: impression.images.map((item) => item.trim()).filter(Boolean)
        }))
      });
      refresh();
    } catch (error) {
      setSaveError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "Das Bild ist zu groß für den lokalen Speicher. Lade bitte ein kleineres Bild hoch."
          : "Die Startseite konnte nicht gespeichert werden."
      );
    }
  }

  return (
    <RouteGuard adminOnly>
      <AppShell title="Startseite" eyebrow="Landingpage" contentClassName="landing-editor-page" titleIcon={<GalleryVerticalEnd size={30} />}>
        <form className="landing-editor" onSubmit={handleSave}>
          <section className="landing-editor-hero">
            <div>
              <div className="login-brand">
                <div className="brand-mark large">
                  <AudioLines size={24} />
                </div>
                <div>
                  <span className="eyebrow">AK-Technik</span>
                  <h2>Motion</h2>
                </div>
              </div>
              <label>
                Hero-Überschrift
                <textarea value={content.heroTitle} onChange={(event) => patchContent({ heroTitle: event.target.value })} rows={4} />
              </label>
              <label>
                Hero-Text
                <textarea value={content.heroText} onChange={(event) => patchContent({ heroText: event.target.value })} rows={3} />
              </label>
            </div>
            <div className="landing-editor-gallery">
              {content.eventImages.map((image, index) => (
                <article className="landing-image-card" key={`${image}-${index}`}>
                  <div className="landing-image-preview">{image ? <img alt="" src={image} /> : <span>Kein Bild</span>}</div>
                  <div className="landing-image-card-body">
                    <strong>Hero-Bild {index + 1}</strong>
                    <input value={image} onChange={(event) => updateHeroImage(index, event.target.value)} placeholder="Bild-URL oder hochgeladene Datei" />
                    <div className="landing-image-actions">
                      <label className="button compact">
                        Datei ersetzen
                        <input
                          className="visually-hidden"
                          type="file"
                          accept="image/*"
                          onChange={(event) => readImages(event.target.files, ([uploaded]) => updateHeroImage(index, uploaded))}
                        />
                      </label>
                      <button className="button compact danger" type="button" onClick={() => removeHeroImage(index)}>
                        Entfernen
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              <button className="landing-add-card" type="button" onClick={() => patchContent({ eventImages: [...content.eventImages, ""] })}>
                <Plus size={16} />
                Bild hinzufügen
              </button>
            </div>
          </section>

          <section className="landing-editor-block">
            <h2>Team</h2>
            <div className="form-grid">
              <label>
                Gruppenbild
                <input value={content.teamImage} onChange={(event) => patchContent({ teamImage: event.target.value })} />
                <label className="button compact landing-upload-button">
                  Gruppenbild ersetzen
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    onChange={(event) => readImages(event.target.files, ([uploaded]) => patchContent({ teamImage: uploaded }))}
                  />
                </label>
                <button className="button compact danger" type="button" onClick={() => patchContent({ teamImage: "" })}>
                  Gruppenbild entfernen
                </button>
              </label>
              <label>
                Namen, je Zeile ein Name
                <textarea
                  value={content.teamNames.join("\n")}
                  onChange={(event) => patchContent({ teamNames: event.target.value.split("\n") })}
                  rows={5}
                />
              </label>
            </div>
            {content.teamImage ? <img className="landing-editor-wide-image" alt="" src={content.teamImage} /> : null}
          </section>

          <section className="landing-editor-block">
            <h2>Mitglied werden</h2>
            <div className="form-grid">
              <label>
                Überschrift
                <input value={content.joinTitle} onChange={(event) => patchContent({ joinTitle: event.target.value })} />
              </label>
              <label>
                Text
                <textarea value={content.joinText} onChange={(event) => patchContent({ joinText: event.target.value })} rows={4} />
              </label>
            </div>
          </section>

          <section className="landing-editor-block">
            <div className="toolbar">
              <h2>Eindrücke</h2>
              <button className="button" type="button" onClick={addImpression}>
                <Plus size={16} />
                Eindruck hinzufügen
              </button>
            </div>
            <div className="landing-editor-impressions">
              {content.impressions.map((impression) => (
                <article className="panel form-stack" key={impression.id}>
                  <div className="toolbar">
                    <h3>{impression.title}</h3>
                    <button className="icon-button danger" type="button" aria-label="Eindruck löschen" onClick={() => deleteImpression(impression.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label>
                    Titel
                    <input value={impression.title} onChange={(event) => updateImpression(impression.id, { title: event.target.value })} />
                  </label>
                  <label>
                    Text
                    <textarea value={impression.text} onChange={(event) => updateImpression(impression.id, { text: event.target.value })} rows={3} />
                  </label>
                  <label>
                    Bilder
                    <div className="landing-impression-images">
                      {impression.images.map((image, index) => (
                        <article className="landing-image-card is-compact" key={`${image}-${index}`}>
                          <div className="landing-image-preview">{image ? <img alt="" src={image} /> : <span>Kein Bild</span>}</div>
                          <div className="landing-image-card-body">
                            <input
                              value={image}
                              onChange={(event) => updateImpressionImage(impression, index, event.target.value)}
                              placeholder="Bild-URL oder hochgeladene Datei"
                            />
                            <div className="landing-image-actions">
                              <label className="button compact">
                                Ersetzen
                                <input
                                  className="visually-hidden"
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => readImages(event.target.files, ([uploaded]) => updateImpressionImage(impression, index, uploaded))}
                                />
                              </label>
                              <button className="button compact danger" type="button" onClick={() => removeImpressionImage(impression, index)}>
                                Entfernen
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                      <label className="landing-add-card">
                        <Plus size={16} />
                        Bilder hochladen
                        <input
                          className="visually-hidden"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) =>
                            readImages(event.target.files, (uploaded) =>
                              updateImpression(impression.id, { images: [...impression.images.filter(Boolean), ...uploaded] })
                            )
                          }
                        />
                      </label>
                    </div>
                  </label>
                </article>
              ))}
            </div>
          </section>

          <button className="button primary landing-editor-save" type="submit">
            Startseite speichern
          </button>
          {saveError ? <p className="error-text">{saveError}</p> : null}
        </form>
      </AppShell>
    </RouteGuard>
  );
}

function compressImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      image.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Bild konnte nicht verarbeitet werden."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
      image.src = String(reader.result ?? "");
    };
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}
