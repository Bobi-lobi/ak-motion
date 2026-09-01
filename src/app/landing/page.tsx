"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { GalleryVerticalEnd, ImagePlus, Italic, Plus, Save, Trash2, Type, Upload, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { updateLandingContent } from "@/lib/data-store";
import { migrateLandingImage, uploadLandingImage } from "@/lib/landing-storage";
import type { LandingContent, LandingImpression } from "@/lib/types";

type ToolbarState = { x: number; y: number } | null;

export default function LandingEditorPage() {
  const { data, refresh } = useApp();
  const [content, setContent] = useState<LandingContent>(data.landingContent);
  const [saveError, setSaveError] = useState("");
  const [uploadingImages, setUploadingImages] = useState(0);
  const [toolbar, setToolbar] = useState<ToolbarState>(null);
  const [selectedImpressionId, setSelectedImpressionId] = useState(data.landingContent.impressions[0]?.id ?? "");
  const [editingImpressionId, setEditingImpressionId] = useState<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const contentRef = useRef(content);

  useEffect(() => {
    setContent(data.landingContent);
    contentRef.current = data.landingContent;
    setSelectedImpressionId((current) => current || data.landingContent.impressions[0]?.id || "");
  }, [data.landingContent]);

  const selectedImpression =
    content.impressions.find((impression) => impression.id === selectedImpressionId) ?? content.impressions[0] ?? null;
  const editingImpression =
    content.impressions.find((impression) => impression.id === editingImpressionId) ?? null;

  function patchContent(patch: Partial<LandingContent>) {
    setContent((current) => {
      const next = { ...current, ...patch };
      contentRef.current = next;
      return next;
    });
  }

  function updateImpression(id: string, patch: Partial<LandingImpression>) {
    setContent((current) => {
      const next = {
        ...current,
        impressions: current.impressions.map((impression) => (impression.id === id ? { ...impression, ...patch } : impression))
      };
      contentRef.current = next;
      return next;
    });
  }

  function appendImpressionImages(id: string, images: string[]) {
    if (!images.length) {
      return;
    }
    setContent((current) => {
      const next = {
        ...current,
        impressions: current.impressions.map((impression) =>
          impression.id === id ? { ...impression, images: [...impression.images.filter(Boolean), ...images] } : impression
        )
      };
      contentRef.current = next;
      return next;
    });
  }

  function addImpression() {
    const id = `impression-${Date.now()}`;
    patchContent({
      impressions: [
        ...content.impressions,
        {
          id,
          title: "Neue Veranstaltung",
          text: "Kurzer Eindruck der Veranstaltung.",
          images: [content.eventImages[0] ?? ""]
        }
      ]
    });
    setSelectedImpressionId(id);
    setEditingImpressionId(id);
  }

  function deleteImpression(id: string) {
    const next = content.impressions.filter((impression) => impression.id !== id);
    patchContent({ impressions: next });
    if (selectedImpressionId === id) {
      setSelectedImpressionId(next[0]?.id ?? "");
    }
    if (editingImpressionId === id) {
      setEditingImpressionId(null);
    }
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

  function updateTeamName(index: number, name: string) {
    const names = [...content.teamNames];
    names[index] = name;
    patchContent({ teamNames: names });
  }

  function addTeamName() {
    patchContent({ teamNames: [...content.teamNames, "Neuer Name"] });
  }

  function removeTeamName(index: number) {
    patchContent({ teamNames: content.teamNames.filter((_, nameIndex) => nameIndex !== index) });
  }

  async function readImages(fileList: FileList | null, callback: (images: string[]) => void) {
    const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      return;
    }

    setSaveError("");
    setUploadingImages((current) => current + files.length);
    try {
      callback(await Promise.all(files.map((file) => uploadLandingImage(file))));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Bilder konnten nicht hochgeladen werden.");
    } finally {
      setUploadingImages((current) => Math.max(0, current - files.length));
    }
  }

  function syncEditable(field: keyof LandingContent, value: string) {
    patchContent({ [field]: value } as Partial<LandingContent>);
  }

  function syncSelectionToolbar() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setToolbar(null);
      return;
    }

    const anchor = selection.anchorNode instanceof HTMLElement ? selection.anchorNode : selection.anchorNode?.parentElement;
    if (!anchor?.closest(".landing-live-preview")) {
      setToolbar(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    savedRange.current = selection.getRangeAt(0).cloneRange();
    setToolbar({ x: rect.left + rect.width / 2, y: Math.max(12, rect.top - 54) });
  }

  function formatSelection(command: string, value?: string) {
    const selection = window.getSelection();
    if (selection && savedRange.current) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
    document.execCommand(command, false, value);
    syncSelectionToolbar();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    const nextContent = { ...contentRef.current };
    event.currentTarget.querySelectorAll<HTMLElement>("[data-landing-field]").forEach((element) => {
      const field = element.dataset.landingField as keyof LandingContent | undefined;
      if (field) {
        (nextContent[field] as string) = element.innerHTML;
      }
    });

    try {
      const migratedEventImages = await Promise.all(nextContent.eventImages.map(migrateLandingImage));
      const migratedTeamImage = nextContent.teamImage ? await migrateLandingImage(nextContent.teamImage) : "";
      const migratedImpressions = await Promise.all(
        nextContent.impressions.map(async (impression) => ({
          ...impression,
          images: await Promise.all(impression.images.map(migrateLandingImage))
        }))
      );
      await updateLandingContent({
        ...nextContent,
        heroTitle: nextContent.heroTitle.trim(),
        heroText: nextContent.heroText.trim(),
        brandTitle: nextContent.brandTitle.trim(),
        heroKicker: nextContent.heroKicker.trim(),
        primaryButtonText: nextContent.primaryButtonText.trim(),
        requestButtonText: nextContent.requestButtonText.trim(),
        impressionsKicker: nextContent.impressionsKicker.trim(),
        impressionsTitle: nextContent.impressionsTitle.trim(),
        teamKicker: nextContent.teamKicker.trim(),
        teamTitle: nextContent.teamTitle.trim(),
        requestKicker: nextContent.requestKicker.trim(),
        requestTitle: nextContent.requestTitle.trim(),
        requestText: nextContent.requestText.trim(),
        requestCta: nextContent.requestCta.trim(),
        joinTitle: nextContent.joinTitle.trim(),
        joinText: nextContent.joinText.trim(),
        eventImages: migratedEventImages.map((item) => item.trim()).filter(Boolean),
        teamImage: migratedTeamImage.trim(),
        teamNames: nextContent.teamNames.map((item) => item.trim()).filter(Boolean),
        impressions: migratedImpressions.map((impression) => ({
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
        <form
          className="landing-editor"
          onSubmit={handleSave}
          onMouseUp={syncSelectionToolbar}
          onKeyUp={syncSelectionToolbar}
        >
          {toolbar ? (
            <div className="landing-format-toolbar" style={{ left: toolbar.x, top: toolbar.y }}>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("bold")}>
                B
              </button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("italic")}>
                <Italic size={15} />
              </button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("fontSize", "3")}>
                <Type size={14} />
              </button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("fontSize", "5")}>
                Groß
              </button>
              <select
                aria-label="Schriftart"
                onMouseDown={(event) => event.preventDefault()}
                onChange={(event) => formatSelection("fontName", event.target.value)}
              >
                <option value="Inter">Inter</option>
                <option value="Georgia">Georgia</option>
                <option value="Arial">Arial</option>
                <option value="Courier New">Mono</option>
              </select>
            </div>
          ) : null}

          <section className="landing-live-preview">
            <nav className="landing-nav landing-editor-nav" aria-label="Startseitenkopf bearbeiten">
              <div className="login-brand">
                <img className="brand-mark" src="/ak-motion-logo.png" alt="Motion" />
                <strong
                  data-landing-field="brandTitle"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => syncEditable("brandTitle", event.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: content.brandTitle }}
                />
              </div>
            </nav>
            <div className="landing-live-hero">
              <div className="landing-copy">
                <span
                  className="landing-kicker"
                  data-landing-field="heroKicker"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => syncEditable("heroKicker", event.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: content.heroKicker }}
                />
                <h2
                  data-landing-field="heroTitle"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => syncEditable("heroTitle", event.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: content.heroTitle }}
                />
                <p
                  data-landing-field="heroText"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => syncEditable("heroText", event.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: content.heroText }}
                />
                <div className="landing-actions">
                  <button className="button primary landing-member-button" type="button">
                    <span
                      data-landing-field="primaryButtonText"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(event) => syncEditable("primaryButtonText", event.currentTarget.innerHTML)}
                      dangerouslySetInnerHTML={{ __html: content.primaryButtonText }}
                    />
                  </button>
                  <button className="button landing-request-button" type="button">
                    <span
                      data-landing-field="requestButtonText"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(event) => syncEditable("requestButtonText", event.currentTarget.innerHTML)}
                      dangerouslySetInnerHTML={{ __html: content.requestButtonText }}
                    />
                  </button>
                </div>
              </div>

              <div className="landing-gallery live" aria-label="Hero-Bilder bearbeiten">
                {content.eventImages.filter(Boolean).map((image, index) => (
                  <article key={`${image}-${index}`}>
                    <img alt="" src={image} className={index === 0 ? "is-featured" : ""} />
                    <div className="landing-image-hover-actions">
                      <label className="icon-button">
                        <Upload size={14} />
                        <input
                          className="visually-hidden"
                          type="file"
                          accept="image/*"
                          onChange={(event) => readImages(event.target.files, ([uploaded]) => updateHeroImage(index, uploaded))}
                        />
                      </label>
                      <button className="icon-button danger" type="button" aria-label="Bild entfernen" onClick={() => removeHeroImage(index)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
                <label className="landing-live-add-image">
                  <ImagePlus size={18} />
                  Bilder hinzufügen
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => readImages(event.target.files, (uploaded) => patchContent({ eventImages: [...content.eventImages.filter(Boolean), ...uploaded] }))}
                  />
                </label>
              </div>
            </div>

            <section className="landing-stats landing-editor-stats" aria-label="Motion Zahlen">
              {content.stats.map((stat, index) => (
                <article key={stat.id}>
                  <label className="landing-stat-suffix">
                    <input
                      aria-label={`Suffix für ${stat.label}`}
                      value={stat.suffix}
                      onChange={(event) =>
                        patchContent({
                          stats: content.stats.map((item) => (item.id === stat.id ? { ...item, suffix: event.target.value } : item))
                        })
                      }
                    />
                  </label>
                  <input
                    className="landing-stat-label-input"
                    aria-label={`Counter-Beschriftung ${index + 1}`}
                    value={stat.label}
                    onChange={(event) =>
                      patchContent({
                        stats: content.stats.map((item) => (item.id === stat.id ? { ...item, label: event.target.value } : item))
                      })
                    }
                  />
                  <strong>{stat.id === "technicians" ? data.profiles.length : stat.id === "lamps" ? 64 : stat.id === "events" ? 3 : 1}{stat.suffix}</strong>
                  <span>{stat.label}</span>
                </article>
              ))}
            </section>

            <section className="landing-impressions">
              <div className="landing-section-head">
                <div>
                  <span
                    className="eyebrow"
                    data-landing-field="impressionsKicker"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => syncEditable("impressionsKicker", event.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: content.impressionsKicker }}
                  />
                  <h2
                    data-landing-field="impressionsTitle"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => syncEditable("impressionsTitle", event.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: content.impressionsTitle }}
                  />
                </div>
                <span className="landing-impression-count">{content.impressions.length} Einträge</span>
              </div>
              <div className="landing-impression-workspace">
                <div className="landing-impression-rail" aria-label="Eindrücke auswählen">
                  {content.impressions.map((impression) => {
                    const images = impression.images.filter(Boolean);
                    return (
                      <button
                        className={selectedImpression?.id === impression.id ? "landing-impression-tile is-selected" : "landing-impression-tile"}
                        key={impression.id}
                        type="button"
                        onClick={() => {
                          setSelectedImpressionId(impression.id);
                          setEditingImpressionId(impression.id);
                        }}
                      >
                        <span className="landing-image-stack" aria-hidden="true">
                          {images.slice(0, 3).map((image, index) => (
                            <img key={`${image}-${index}`} src={image} alt="" />
                          ))}
                          {!images.length ? <ImagePlus size={24} /> : null}
                        </span>
                        <strong>{impression.title || "Ohne Titel"}</strong>
                        <span>{images.length} Bilder</span>
                      </button>
                    );
                  })}
                  <button className="landing-impression-add-tile" type="button" onClick={addImpression}>
                    <Plus size={18} />
                    Eindruck hinzufügen
                  </button>
                </div>
                {!content.impressions.length ? (
                  <button className="landing-impression-empty" type="button" onClick={addImpression}>
                    <Plus size={18} />
                    Ersten Eindruck hinzufügen
                  </button>
                ) : null}
              </div>
            </section>

            <section className="landing-live-team">
              <div>
                <span
                  className="eyebrow"
                  data-landing-field="teamKicker"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => syncEditable("teamKicker", event.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: content.teamKicker }}
                />
                <h2
                  data-landing-field="teamTitle"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => syncEditable("teamTitle", event.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: content.teamTitle }}
                />
              </div>
              <figure>
                {content.teamImage ? <img alt="" src={content.teamImage} /> : null}
                <div className="landing-image-hover-actions">
                  <label className="icon-button">
                    <Upload size={14} />
                    <input
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      onChange={(event) => readImages(event.target.files, ([uploaded]) => patchContent({ teamImage: uploaded }))}
                    />
                  </label>
                  <button className="icon-button danger" type="button" onClick={() => patchContent({ teamImage: "" })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </figure>
              <div className="landing-live-names">
                {content.teamNames.map((name, index) => (
                  <div key={`team-name-${index}`}>
                    <input value={name} onChange={(event) => updateTeamName(index, event.target.value)} aria-label={`Name ${index + 1}`} />
                    <button className="icon-button danger" type="button" aria-label="Namen entfernen" onClick={() => removeTeamName(index)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button className="button compact" type="button" onClick={addTeamName}>
                  <Plus size={16} />
                  Name hinzufügen
                </button>
              </div>
            </section>

            <section className="landing-request-section">
              <article className="landing-request-card">
                <div>
                  <span
                    className="eyebrow"
                    data-landing-field="requestKicker"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => syncEditable("requestKicker", event.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: content.requestKicker }}
                  />
                  <h2
                    data-landing-field="requestTitle"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => syncEditable("requestTitle", event.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: content.requestTitle }}
                  />
                  <p
                    data-landing-field="requestText"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => syncEditable("requestText", event.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: content.requestText }}
                  />
                </div>
                <button className="button primary landing-member-button" type="button">
                  <span
                    data-landing-field="requestCta"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => syncEditable("requestCta", event.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: content.requestCta }}
                  />
                </button>
              </article>
            </section>

            <article className="join-card landing-live-join" id="join">
              <h2
                data-landing-field="joinTitle"
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => syncEditable("joinTitle", event.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: content.joinTitle }}
              />
              <p
                data-landing-field="joinText"
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => syncEditable("joinText", event.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: content.joinText }}
              />
            </article>
          </section>

          {editingImpression ? (
            <div className="page-modal-backdrop landing-editor-modal-backdrop" role="presentation" onClick={() => setEditingImpressionId(null)}>
              <section
                className="impression-modal landing-editor-impression-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${editingImpression.title} bearbeiten`}
                onClick={(event) => event.stopPropagation()}
              >
                <button className="icon-button ghost impression-close" type="button" aria-label="Schließen" onClick={() => setEditingImpressionId(null)}>
                  <X size={18} />
                </button>
                <div className="landing-impression-image-manager">
                  <div className="landing-image-stack large" aria-label="Bildstapel">
                    {editingImpression.images.filter(Boolean).slice(0, 5).map((image, index) => (
                      <img key={`${image}-${index}`} src={image} alt="" />
                    ))}
                    {!editingImpression.images.filter(Boolean).length ? <ImagePlus size={32} /> : null}
                  </div>
                  <div className="landing-impression-image-actions">
                    {editingImpression.images.filter(Boolean).map((image, index) => (
                      <article key={`${image}-${index}`}>
                        <img src={image} alt="" />
                        <div>
                          <strong>Bild {index + 1}</strong>
                          <span>{index === 0 ? "Titelbild" : "Slideshow"}</span>
                        </div>
                        <label className="icon-button" title="Bild ersetzen">
                          <Upload size={14} />
                          <input
                            className="visually-hidden"
                            type="file"
                            accept="image/*"
                            onChange={(event) => readImages(event.target.files, ([uploaded]) => updateImpressionImage(editingImpression, index, uploaded))}
                          />
                        </label>
                        <button className="icon-button danger" type="button" onClick={() => removeImpressionImage(editingImpression, index)}>
                          <Trash2 size={14} />
                        </button>
                      </article>
                    ))}
                    <label className="button compact landing-impression-upload">
                      <Plus size={16} />
                      Bilder hinzufügen
                      <input
                        className="visually-hidden"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          readImages(event.target.files, (uploaded) =>
                            appendImpressionImages(editingImpression.id, uploaded)
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="impression-modal-copy landing-live-impression-text">
                  <span className="eyebrow">Eindruck bearbeiten</span>
                  <label>
                    Titel
                    <input
                      value={editingImpression.title}
                      onChange={(event) => updateImpression(editingImpression.id, { title: event.target.value })}
                      aria-label="Titel"
                    />
                  </label>
                  <label>
                    Text
                    <textarea
                      value={editingImpression.text}
                      onChange={(event) => updateImpression(editingImpression.id, { text: event.target.value })}
                      aria-label="Text"
                    />
                  </label>
                  <button className="button compact danger" type="button" onClick={() => deleteImpression(editingImpression.id)}>
                    <Trash2 size={15} />
                    Eindruck entfernen
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          <div className="landing-editor-savebar">
            {saveError ? <p className="error-text">{saveError}</p> : null}
            <button className="button primary" type="submit" disabled={uploadingImages > 0}>
              <Save size={16} />
              {uploadingImages > 0 ? `${uploadingImages} Bild${uploadingImages === 1 ? "" : "er"} werden hochgeladen` : "Startseite speichern"}
            </button>
          </div>
        </form>
      </AppShell>
    </RouteGuard>
  );
}
