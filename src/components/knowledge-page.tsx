"use client";

import { Check, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const pendingContentRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const saveAgainRef = useRef(false);
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

  async function submitSuggestion() {
    if (!session || !suggestionDraft.trim()) {
      return;
    }

    await createKnowledgeSuggestion(pageId, suggestionDraft, session);
    setSuggestionDraft("");
    refresh();
  }

  const flushOfficialContent = useCallback(async () => {
    if (savingRef.current) {
      saveAgainRef.current = true;
      return;
    }

    const content = pendingContentRef.current;
    if (content === null) {
      return;
    }

    pendingContentRef.current = null;
    savingRef.current = true;
    try {
      await updateKnowledgePage(pageId, content, session);
    } finally {
      savingRef.current = false;
      if (saveAgainRef.current || pendingContentRef.current !== null) {
        saveAgainRef.current = false;
        void flushOfficialContent();
      }
    }
  }, [pageId, session]);

  const saveOfficialContent = useCallback(
    (content: string) => {
      pendingContentRef.current = content;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void flushOfficialContent();
      }, 450);
    },
    [flushOfficialContent]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      void flushOfficialContent();
    },
    [flushOfficialContent]
  );

  return (
    <RouteGuard>
      <AppShell
        title={definition.title}
        eyebrow={definition.eyebrow}
        contentClassName={usesSuggestions ? "knowledge-document-page has-suggestions" : "knowledge-document-page"}
        titleIcon={<Icon size={30} />}
      >
        <section className="knowledge-layout">
          <div className="knowledge-main">
            <div className="knowledge-page-shell">
              {isAdmin || !usesSuggestions ? (
                <SlashRichTextEditor
                  value={page.content}
                  onChange={saveOfficialContent}
                  placeholder="Schreibe etwas oder tippe / für Befehle..."
                  currentUser={session}
                  realtimeKey={`knowledge-${pageId}`}
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
                  currentUser={session}
                  realtimeKey={`knowledge-suggestion-${pageId}-${session?.id ?? "guest"}`}
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
                        onClick={async () => {
                          await acceptKnowledgeSuggestion(suggestion.id, session);
                          refresh();
                        }}
                      >
                        <Check size={16} />
                        Übernehmen
                      </button>
                      <button
                        className="button danger"
                        type="button"
                        onClick={async () => {
                          await deleteKnowledgeSuggestion(suggestion.id);
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
