"use client";

import { FileText, Film, Image as ImageIcon, LoaderCircle, MessageCircle, Paperclip, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { deleteChatMessage, loadChatMessages, loadChatReadReceipts, markChatRead, sendChatMessage } from "@/lib/data-store";
import { uploadAppMedia } from "@/lib/media-storage";
import { supabase } from "@/lib/supabase";
import type { AttachmentFile, ChatMessage, ChatReadReceipt } from "@/lib/types";

export default function ChatPage() {
  const { data, isAdmin, session } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [receipts, setReceipts] = useState<ChatReadReceipt[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const profilesById = useMemo(() => new Map(data.profiles.map((profile) => [profile.id, profile])), [data.profiles]);

  const refresh = useCallback(async () => {
    try {
      const [nextMessages, nextReceipts] = await Promise.all([
        loadChatMessages(),
        loadChatReadReceipts().catch(() => [])
      ]);
      setMessages(nextMessages);
      setReceipts(nextReceipts);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_read_receipts" }, () => void refresh())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? "auto" : "smooth" });
    const latest = messages.at(-1);
    if (!session || !latest || document.visibilityState !== "visible") return;
    if (receipts.some((receipt) => receipt.profileId === session.id && receipt.messageId === latest.id)) return;
    setReceipts((current) => [...current.filter((receipt) => receipt.profileId !== session.id), { profileId: session.id, messageId: latest.id, readAt: new Date().toISOString() }]);
    void markChatRead(session.id, latest.id).catch(() => undefined);
  }, [loading, messages, receipts, session]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setSending(true);
    setError("");
    try {
      const uploaded = await Promise.all(Array.from(files).map(async (file) => ({ name: file.name, type: file.type || "application/octet-stream", url: await uploadAppMedia(file, "chat") })));
      setAttachments((current) => [...current, ...uploaded]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Datei konnte nicht hochgeladen werden.");
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!session || sending || (!body.trim() && !attachments.length)) return;
    const nextBody = body;
    const nextAttachments = attachments;
    setBody("");
    setAttachments([]);
    setSending(true);
    setError("");
    try {
      await sendChatMessage(session.id, nextBody, nextAttachments);
      await refresh();
    } catch (caught) {
      setBody(nextBody);
      setAttachments(nextAttachments);
      setError(caught instanceof Error ? caught.message : "Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  return (
    <RouteGuard>
      <AppShell title="Chat" eyebrow="Team" contentClassName="chat-page">
        <section className="team-chat" aria-label="Teamchat">
          <header className="chat-topbar"><span className="chat-topbar-icon"><MessageCircle size={21} /></span><div><strong>Teamchat</strong><span>{data.profiles.length} Mitglieder</span></div></header>
          <div className="chat-stream">
            {loading ? <div className="chat-loading"><LoaderCircle className="spin" size={24} /> Teamchat wird geladen...</div> : null}
            {!loading && !messages.length ? <div className="chat-welcome"><MessageCircle size={25} /><strong>Noch keine Nachrichten</strong><span>Starte die Unterhaltung mit deinem Team.</span></div> : null}
            {messages.map((message) => {
              const author = profilesById.get(message.authorId);
              const own = message.authorId === session?.id;
              const emojiOnly = !message.attachments.length && isEmojiOnly(message.body);
              const readers = receipts.filter((receipt) => receipt.messageId === message.id && receipt.profileId !== message.authorId).map((receipt) => profilesById.get(receipt.profileId)).filter(Boolean);
              return (
                <div className={own ? "chat-message-row is-own" : "chat-message-row"} key={message.id}>
                  <article className={["chat-message", own ? "is-own" : "", emojiOnly ? "is-emoji-only" : ""].filter(Boolean).join(" ")}>
                    {!emojiOnly ? <div className="chat-message-meta"><strong>{author?.name ?? "Ehemaliges Mitglied"}</strong><time>{formatMessageTime(message.createdAt)}</time></div> : null}
                    {message.body ? <p>{message.body}</p> : null}
                    {message.attachments.length ? <div className="chat-attachments">{message.attachments.map(renderAttachment)}</div> : null}
                    {own || isAdmin ? <button className="chat-delete" type="button" aria-label="Nachricht löschen" onClick={async () => { await deleteChatMessage(message.id); await refresh(); }}><Trash2 size={14} /></button> : null}
                  </article>
                  {readers.length ? <span className="chat-readers">Gelesen von {readers.map((reader) => reader?.name).join(", ")}</span> : null}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <div className="chat-composer">
            {attachments.length ? <div className="chat-upload-list">{attachments.map((file, index) => <span key={`${file.url}-${index}`}><Paperclip size={13} />{file.name}<button type="button" aria-label={`${file.name} entfernen`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button></span>)}</div> : null}
            {error ? <p className="error-text">{error}</p> : null}
            <div><label className="icon-button chat-attach-button" title="Bild, Meme oder Datei anhängen"><Paperclip size={19} /><input className="visually-hidden" type="file" accept="image/*,video/*,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" multiple onChange={(event) => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Nachricht schreiben..." rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} /><button className="icon-button primary chat-send-button" type="button" aria-label="Nachricht senden" disabled={sending || (!body.trim() && !attachments.length)} onClick={() => void submit()}>{sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}</button></div>
          </div>
        </section>
      </AppShell>
    </RouteGuard>
  );
}

function renderAttachment(file: AttachmentFile, index: number) {
  if (file.type.startsWith("image/")) return <a href={file.url} target="_blank" rel="noreferrer" key={`${file.url}-${index}`} className="chat-image"><img src={file.url} alt={file.name} /><span><ImageIcon size={14} />{file.name}</span></a>;
  if (file.type.startsWith("video/")) return <div className="chat-video" key={`${file.url}-${index}`}><video src={file.url} controls playsInline /><span><Film size={14} />{file.name}</span></div>;
  return <a href={file.url} target="_blank" rel="noreferrer" download={file.name} key={`${file.url}-${index}`}><FileText size={16} />{file.name}</a>;
}

function isEmojiOnly(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed.length <= 32 && /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u.test(trimmed);
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
