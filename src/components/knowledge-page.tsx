"use client";

import { Check, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useApp } from "@/components/app-provider";
import { SlashRichTextEditor } from "@/components/event-page-modal";
import { RouteGuard } from "@/components/route-guard";
import {
  acceptKnowledgeSuggestion,
  createKnowledgeSuggestion,
  deleteKnowledgeSuggestion,
  updateKnowledgePage
} from "@/lib/data-store";
import { getKnowledgePageDefinition } from "@/lib/knowledge";
import type { KnowledgePageId } from "@/lib/types";

export function KnowledgePageView({ pageId }: { pageId: KnowledgePageId }) {
  const definition = getKnowledgePageDefinition(pageId);
  const { data, isAdmin, refresh, session } = useApp();
  const [suggestionDraft, setSuggestionDraft] = useState("");
  const usesSuggestions = pageId === "rules";
  const page = data.knowledgePages.find((item) => item.id === pageId) ?? {
    id: pageId,
    title: definition.title,
    content: "",
    updatedAt: ""
  };
  const suggestions = useMemo(
    () => data.knowledgeSuggestions.filter((suggestion) => suggestion.pageId === pageId),
    [data.knowledgeSuggestions, pageId]
  );
  const Icon = definition.icon;

  function submitSuggestion() {
    if (!session || !suggestionDraft.trim()) {
      return;
    }

    createKnowledgeSuggestion(pageId, suggestionDraft, session);
    setSuggestionDraft("");
    refresh();
  }

  function saveOfficialContent(content: string) {
    updateKnowledgePage(pageId, content, session);
    refresh();
  }

  return (
    <RouteGuard>
      <AppShell title={definition.title} eyebrow={definition.eyebrow} contentClassName="knowledge-document-page" titleIcon={<Icon size={30} />}>
        <section className="knowledge-layout">
          <div className="knowledge-main">
            <div className="knowledge-page-shell">
              {isAdmin || !usesSuggestions ? (
                <SlashRichTextEditor
                  value={page.content}
                  onChange={saveOfficialContent}
                  placeholder="Schreibe etwas oder tippe / für Befehle..."
                />
              ) : page.content.trim() ? (
                <div className="knowledge-content" dangerouslySetInnerHTML={{ __html: page.content }} />
              ) : (
                <p className="knowledge-empty">Diese Seite ist noch leer.</p>
              )}
            </div>
          </div>

          {usesSuggestions ? (
            <aside className="knowledge-suggestions">
              <div className="knowledge-panel">
                <h2>Vorschläge</h2>
                <p>Alle können Ideen ergänzen. Die Teamleitung übernimmt passende Beiträge in die offizielle Seite.</p>
                <SlashRichTextEditor
                  value={suggestionDraft}
                  onChange={setSuggestionDraft}
                  placeholder="Vorschlag schreiben oder / für Blöcke..."
                />
                <button className="button primary" type="button" onClick={submitSuggestion} disabled={!suggestionDraft.trim()}>
                  Vorschlag einreichen
                </button>
              </div>

              {suggestions.map((suggestion) => (
                <article className="knowledge-suggestion-card" key={suggestion.id}>
                  <div>
                    <strong>{suggestion.authorName}</strong>
                    <span>{new Date(suggestion.createdAt).toLocaleDateString("de-DE")}</span>
                  </div>
                  <div className="knowledge-suggestion-content" dangerouslySetInnerHTML={{ __html: suggestion.content }} />
                  {isAdmin ? (
                    <div className="request-actions">
                      <button
                        className="button success"
                        type="button"
                        onClick={() => {
                          acceptKnowledgeSuggestion(suggestion.id, session);
                          refresh();
                        }}
                      >
                        <Check size={16} />
                        Übernehmen
                      </button>
                      <button
                        className="button danger"
                        type="button"
                        onClick={() => {
                          deleteKnowledgeSuggestion(suggestion.id);
                          refresh();
                        }}
                      >
                        <Trash2 size={16} />
                        Löschen
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </aside>
          ) : null}
        </section>
      </AppShell>
    </RouteGuard>
  );
}
