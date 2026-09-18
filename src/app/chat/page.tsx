"use client";

import { FileText, Image as ImageIcon, LoaderCircle, MessageCircle, Paperclip, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { deleteChatMessage, loadChatMessages, sendChatMessage } from "@/lib/data-store";
import { uploadAppMedia } from "@/lib/media-storage";
import { supabase } from "@/lib/supabase";
import type { AttachmentFile, ChatMessage } from "@/lib/types";

export default function ChatPage() {
  const { data, isAdmin, session } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setMessages(await loadChatMessages());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Der Teamchat konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabase) return;
    const client = supabase;
    const channel = client.channel("ak-motion-team-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => void refresh())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? "auto" : "smooth" });
  }, [loading, messages.length]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setSending(true);
    setError("");
    try {
      const uploaded = await Promise.all(Array.from(files).map(async (file) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        url: await uploadAppMedia(file, "chat")
      })));
      setAttachments((current) => [...current, ...uploaded]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Datei konnte nicht hochgeladen werden.");
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!session || sending || (!body.trim() && !attachments.length)) return;
    setSending(true);
    setError("");
    try {
      await sendChatMessage(session.id, body, attachments);
      setBody("");
      setAttachments([]);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  return (
    <RouteGuard>
      <AppShell title="Chat" eyebrow="Team" titleIcon={<MessageCircle size={30} />} contentClassName="chat-page">
        <section className="team-chat" aria-label="Teamchat">
          <div className="chat-stream">
            {loading ? <div className="chat-loading"><LoaderCircle className="spin" size={24} /> Teamchat wird geladen...</div> : null}
            {!loading && !messages.length ? <div className="empty-state compact"><MessageCircle size={24} /><strong>Noch keine Nachrichten</strong><span>Starte die Unterhaltung mit deinem Team.</span></div> : null}
            {messages.map((message) => {
              const author = data.profiles.find((profile) => profile.id === message.authorId);
              const own = message.authorId === session?.id;
              return (
                <article className={own ? "chat-message is-own" : "chat-message"} key={message.id}>
                  <div className="chat-message-meta"><strong>{author?.name ?? "Ehemaliges Mitglied"}</strong><time>{formatMessageTime(message.createdAt)}</time></div>
                  {message.body ? <p>{message.body}</p> : null}
                  {message.attachments.length ? <div className="chat-attachments">{message.attachments.map((file, index) => file.type.startsWith("image/") ? (
                    <a href={file.url} target="_blank" rel="noreferrer" key={`${file.url}-${index}`} className="chat-image"><img src={file.url} alt={file.name} /><span><ImageIcon size={14} />{file.name}</span></a>
                  ) : (
                    <a href={file.url} target="_blank" rel="noreferrer" download={file.name} key={`${file.url}-${index}`}><FileText size={16} />{file.name}</a>
                  ))}</div> : null}
                  {own || isAdmin ? <button className="chat-delete" type="button" aria-label="Nachricht löschen" onClick={async () => { await deleteChatMessage(message.id); await refresh(); }}><Trash2 size={14} /></button> : null}
                </article>
              );
            })}
            <div ref={endRef} />
          </div>
          <div className="chat-composer">
            {attachments.length ? <div className="chat-upload-list">{attachments.map((file, index) => <span key={`${file.url}-${index}`}><Paperclip size={13} />{file.name}<button type="button" aria-label={`${file.name} entfernen`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button></span>)}</div> : null}
            {error ? <p className="error-text">{error}</p> : null}
            <div>
              <label className="icon-button" title="Bild oder Datei anhängen"><Paperclip size={19} /><input className="visually-hidden" type="file" multiple onChange={(event) => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Nachricht schreiben..." rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} />
              <button className="icon-button primary" type="button" aria-label="Nachricht senden" disabled={sending || (!body.trim() && !attachments.length)} onClick={() => void submit()}>{sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}</button>
            </div>
          </div>
        </section>
      </AppShell>
    </RouteGuard>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
