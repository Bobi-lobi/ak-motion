"use client";

import {
  ArrowDown, BarChart3, CalendarDays, Camera, Check, ChevronRight, Copy, FileText, Film, Forward,
  Image as ImageIcon, Info, LoaderCircle, MessageCircle, Mic, MoreHorizontal,
  Paperclip, Pencil, Pin, PinOff, Plus, Reply, Search, Send, SmilePlus, Square, Trash2, Upload, Users, X
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import {
  clearDirectChatHistory, createChatConversation, deleteChatMessage, forwardChatMessage, leaveChatConversation, loadChatConversations, loadChatMessages,
  loadChatReadReceipts, markChatRead, sendChatMessage, sendChatPoll, toggleChatMessagePin,
  toggleChatReaction, updateChatConversation, updateChatMessage, voteChatPoll
} from "@/lib/data-store";
import { prepareChatImage, uploadAppMedia } from "@/lib/media-storage";
import { supabase } from "@/lib/supabase";
import type { AttachmentFile, ChatConversation, ChatMessage, ChatReadReceipt, Event, Profile } from "@/lib/types";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const TEAM_CHAT_ID = "00000000-0000-0000-0000-000000000001";

export default function ChatPage() {
  const { data, isAdmin, session } = useApp();
  const sessionId = session?.id;
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState(TEAM_CHAT_ID);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [receipts, setReceipts] = useState<ChatReadReceipt[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [openReaders, setOpenReaders] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: ChatMessage; x: number; y: number } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<AttachmentFile | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [chatListOpen, setChatListOpen] = useState(false);
  const [composeMenuOpen, setComposeMenuOpen] = useState(false);
  const [swiping, setSwiping] = useState<{ id: string; offset: number } | null>(null);
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const typingSentAtRef = useRef(0);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const initialScrollPendingRef = useRef(true);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const swipeStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const messagesRequestRef = useRef(0);
  const profilesById = useMemo(() => new Map(data.profiles.map((profile) => [profile.id, profile])), [data.profiles]);
  const activeConversation = conversations.find((conversation) => conversation.id === activeId);
  const referenceQuery = eventReferenceQuery(body);
  const mentionQuery = personMentionQuery(body);
  const eventSuggestions = useMemo(() => referenceQuery === null ? [] : data.events
    .filter((event) => event.title.toLocaleLowerCase("de").includes(referenceQuery.toLocaleLowerCase("de")))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()).slice(0, 6), [data.events, referenceQuery]);
  const mentionSuggestions = useMemo(() => mentionQuery === null ? [] : data.profiles
    .filter((profile) => activeConversation?.memberIds.includes(profile.id))
    .filter((profile) => profile.name.toLocaleLowerCase("de").includes(mentionQuery.toLocaleLowerCase("de"))).slice(0, 6), [activeConversation?.memberIds, data.profiles, mentionQuery]);

  const refreshConversations = useCallback(async () => {
    if (!sessionId) return;
    const next = await loadChatConversations(sessionId);
    setConversations(next);
    if (next.length && !next.some((conversation) => conversation.id === activeId)) setActiveId(next[0].id);
  }, [activeId, sessionId]);

  const refreshMessages = useCallback(async () => {
    if (!activeId) return;
    const requestId = ++messagesRequestRef.current;
    try {
      const [nextMessages, nextReceipts] = await Promise.all([loadChatMessages(activeId, 120, activeConversation?.clearedAt), loadChatReadReceipts(activeId).catch(() => [])]);
      if (requestId !== messagesRequestRef.current) return;
      setMessages(nextMessages); setReceipts(nextReceipts); setError("");
    } catch (caught) {
      if (requestId === messagesRequestRef.current) setError(caught instanceof Error ? caught.message : "Der Chat konnte nicht geladen werden.");
    } finally { if (requestId === messagesRequestRef.current) setLoading(false); }
  }, [activeId, activeConversation?.clearedAt]);

  useEffect(() => { void refreshConversations().catch(() => undefined); }, [refreshConversations]);
  useEffect(() => { initialScrollPendingRef.current = true; setLoading(true); setMessages([]); setReplyingTo(null); void refreshMessages(); }, [refreshMessages]);

  useEffect(() => {
    if (loading || !initialScrollPendingRef.current || !streamRef.current) return;
    initialScrollPendingRef.current = false;
    const stream = streamRef.current;
    window.requestAnimationFrame(() => { stream.scrollTop = stream.scrollHeight; setShowJumpToLatest(false); });
  }, [activeId, loading]);

  function updateJumpToLatest() {
    const stream = streamRef.current;
    if (stream) setShowJumpToLatest(stream.scrollHeight - stream.scrollTop - stream.clientHeight > 90);
  }

  function publishTyping(conversationId: string, isTyping: boolean) {
    if (!supabase) return;
    void (async () => {
      try {
        const { error: typingError } = await supabase.rpc("set_chat_typing", { conversation_uuid: conversationId, is_typing: isTyping });
        if (typingError) console.error("Schreibstatus konnte nicht gespeichert werden:", typingError);
      } catch (typingError) { console.error("Schreibstatus konnte nicht gespeichert werden:", typingError); }
    })();
  }

  useEffect(() => {
    if (!supabase || !sessionId || !activeId) return;
    typingSentAtRef.current = 0;
    const client = supabase;
    let disposed = false;
    const refreshTyping = async () => {
      const { data: rows, error: typingError } = await client.rpc("get_chat_typing", { conversation_uuid: activeId });
      if (typingError) { console.error("Schreibstatus konnte nicht geladen werden:", typingError); return; }
      if (!disposed) setTypingIds((rows ?? []).map((row: { profile_id: string }) => row.profile_id));
    };
    void refreshTyping();
    const channel = client.channel(`ak-motion-typing-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_typing_status", filter: `conversation_id=eq.${activeId}` }, () => void refreshTyping())
      .subscribe();
    const timer = window.setInterval(() => void refreshTyping(), 2000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      void client.rpc("set_chat_typing", { conversation_uuid: activeId, is_typing: false });
      void client.removeChannel(channel);
      setTypingIds([]);
    };
  }, [activeId, sessionId]);

  useEffect(() => {
    if (!supabase || !sessionId || !activeId || !body.trim()) return;
    const timer = window.setInterval(() => {
      if (document.activeElement !== textareaRef.current) return;
      typingSentAtRef.current = Date.now();
      publishTyping(activeId, true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeId, body, sessionId]);

  function updateBody(value: string) {
    setBody(value);
    if (!supabase || !sessionId) return;
    if (!value.trim()) {
      publishTyping(activeId, false);
      return;
    }
    if (Date.now() - typingSentAtRef.current < 2200) return;
    typingSentAtRef.current = Date.now();
    publishTyping(activeId, true);
  }

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client.channel(`ak-motion-chats-${sessionId ?? "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => { void refreshMessages(); void refreshConversations(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_read_receipts" }, () => { void refreshMessages(); void refreshConversations(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_poll_votes" }, () => void refreshMessages())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" }, () => void refreshMessages())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => void refreshConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversation_members" }, () => void refreshConversations())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") { void refreshMessages(); void refreshConversations(); }
      });
    return () => { void client.removeChannel(channel); };
  }, [refreshConversations, refreshMessages, sessionId]);

  useEffect(() => {
    const refreshVisibleChat = () => {
      if (document.visibilityState !== "visible") return;
      void refreshMessages();
      void refreshConversations();
    };
    window.addEventListener("focus", refreshVisibleChat);
    window.addEventListener("pageshow", refreshVisibleChat);
    document.addEventListener("visibilitychange", refreshVisibleChat);
    const timer = window.setInterval(refreshVisibleChat, 20000);
    return () => {
      window.removeEventListener("focus", refreshVisibleChat);
      window.removeEventListener("pageshow", refreshVisibleChat);
      document.removeEventListener("visibilitychange", refreshVisibleChat);
      window.clearInterval(timer);
    };
  }, [refreshConversations, refreshMessages]);

  useEffect(() => {
    const latest = messages.at(-1);
    if (!session || !latest || document.visibilityState !== "visible") return;
    if (receipts.some((receipt) => receipt.profileId === session.id && receipt.messageId === latest.id)) return;
    setReceipts((current) => [...current.filter((receipt) => receipt.profileId !== session.id), { conversationId: activeId, profileId: session.id, messageId: latest.id, readAt: new Date().toISOString() }]);
    void markChatRead(session.id, activeId, latest.id).then(refreshConversations).catch(() => undefined);
  }, [activeId, loading, messages, receipts, refreshConversations, session]);

  useEffect(() => {
    if (!recording) return;
    setRecordingSeconds(0);
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(() => () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); recordingStreamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => { const close = () => setContextMenu(null); window.addEventListener("click", close); window.addEventListener("resize", close); return () => { window.removeEventListener("click", close); window.removeEventListener("resize", close); }; }, []);
  useEffect(() => {
    if (!previewImage) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewImage(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewImage]);

  async function addFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files); if (!selectedFiles.length) return;
    setSending(true); setError("");
    try {
      const uploaded = await Promise.all(selectedFiles.map(async (file) => {
        const prepared = await prepareChatImage(file);
        return { name: prepared.name, type: prepared.type || "application/octet-stream", url: await uploadAppMedia(prepared, "chat") };
      }));
      setAttachments((current) => [...current, ...uploaded]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Datei konnte nicht hochgeladen werden."); }
    finally { setSending(false); }
  }

  async function submit() {
    if (!session || sending || (!body.trim() && !attachments.length)) return;
    const nextBody = body; const nextAttachments = attachments; const nextReply = replyingTo;
    setBody(""); setAttachments([]); setReplyingTo(null); setSending(true); setError("");
    publishTyping(activeId, false);
    try { const warning = await sendChatMessage(session.id, activeId, nextBody, nextAttachments, nextReply?.id); await Promise.all([refreshMessages(), refreshConversations()]); if (warning) setError(`Nachricht gespeichert. ${warning}`); }
    catch (caught) { setBody(nextBody); setAttachments(nextAttachments); setReplyingTo(nextReply); setError(caught instanceof Error ? caught.message : "Nachricht konnte nicht gesendet werden."); }
    finally { setSending(false); }
  }

  async function submitPoll() {
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!session || !pollQuestion.trim() || options.length < 2 || sending) return;
    setSending(true); setError("");
    try { const warning = await sendChatPoll(session.id, activeId, pollQuestion, options, pollMultiple); setPollQuestion(""); setPollOptions(["", ""]); setPollMultiple(false); setPollOpen(false); await refreshMessages(); if (warning) setError(`Umfrage gespeichert. ${warning}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Umfrage konnte nicht erstellt werden."); }
    finally { setSending(false); }
  }

  async function togglePollVote(message: ChatMessage, optionId: string) {
    if (!session || !message.poll) return;
    const selected = message.poll.options.some((option) => option.id === optionId && option.voterIds.includes(session.id));
    await voteChatPoll(message.id, optionId, session.id, message.poll.allowMultiple, selected).then(refreshMessages).catch((caught) => setError(caught instanceof Error ? caught.message : "Stimme konnte nicht gespeichert werden."));
  }

  async function react(message: ChatMessage, emoji: string) {
    if (!session) return;
    const selected = message.reactions.some((reaction) => reaction.emoji === emoji && reaction.profileIds.includes(session.id));
    setContextMenu(null);
    await toggleChatReaction(message.id, session.id, emoji, selected).then(refreshMessages).catch((caught) => setError(caught instanceof Error ? caught.message : "Reaktion konnte nicht gespeichert werden."));
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Sprachnachrichten werden von diesem Browser nicht unterstützt."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingStreamRef.current = stream; recordingChunksRef.current = []; recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => { const type = recorder.mimeType || "audio/webm"; const extension = type.includes("mp4") ? "m4a" : "webm"; const file = new File(recordingChunksRef.current, `sprachnachricht-${Date.now()}.${extension}`, { type }); stream.getTracks().forEach((track) => track.stop()); recordingStreamRef.current = null; recorderRef.current = null; setRecording(false); void addFiles([file]); };
      recorder.start(250); setRecording(true); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Mikrofon konnte nicht geöffnet werden."); }
  }

  function insertEventReference(event: Event) { const match = body.match(/\[{1,2}([^\[\]\n]*)$/); if (!match) return; setBody(`${body.slice(0, -match[0].length)}[[${event.title}]] `); window.requestAnimationFrame(() => textareaRef.current?.focus()); }
  function insertMention(profile: Profile) { const match = body.match(/(?:^|\s)@([^@\n]*)$/); if (!match) return; const at = body.lastIndexOf("@"); setBody(`${body.slice(0, at)}@${profile.name} `); window.requestAnimationFrame(() => textareaRef.current?.focus()); }
  function selectConversation(id: string) { setActiveId(id); setChatListOpen(false); setDetailsOpen(false); }
  async function editMessage(message: ChatMessage) { setContextMenu(null); const next = window.prompt("Nachricht bearbeiten", message.body); if (next === null || !next.trim() || next.trim() === message.body) return; await updateChatMessage(message.id, next).then(refreshMessages).catch((caught) => setError(caught instanceof Error ? caught.message : "Nachricht konnte nicht bearbeitet werden.")); }
  async function removeMessage(message: ChatMessage) { setContextMenu(null); if (!window.confirm("Diese Nachricht wirklich löschen?")) return; await deleteChatMessage(message.id).then(refreshMessages).catch((caught) => setError(caught instanceof Error ? caught.message : "Nachricht konnte nicht gelöscht werden.")); }
  async function pinMessage(message: ChatMessage) { if (!session) return; setContextMenu(null); await toggleChatMessagePin(message.id, !message.pinnedAt).then(refreshMessages).catch((caught) => setError(caught instanceof Error ? caught.message : "Pin konnte nicht geändert werden.")); }
  async function clearHistory() {
    if (!activeConversation || activeConversation.kind !== "direct") return;
    if (!window.confirm(`Den Verlauf mit ${conversationTitle(activeConversation, profilesById, sessionId)} nur für dich ausblenden? Die andere Person behält ihre Nachrichten.`)) return;
    try {
      await clearDirectChatHistory(activeConversation.id);
      setMessages([]); setReceipts([]); setDetailsOpen(false);
      await refreshConversations();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Verlauf konnte nicht ausgeblendet werden."); }
  }

  async function leaveConversation() {
    if (!activeConversation || activeConversation.id === TEAM_CHAT_ID) return;
    const title = conversationTitle(activeConversation, profilesById, sessionId);
    if (!window.confirm(`„${title}“ wirklich verlassen und aus deiner Chatliste entfernen? Andere Mitglieder behalten ihre Nachrichten.`)) return;
    try {
      await leaveChatConversation(activeConversation.id);
      setDetailsOpen(false); setMessages([]); setReceipts([]);
      const next = await loadChatConversations(sessionId ?? "");
      setConversations(next);
      setActiveId(next.find((conversation) => conversation.id === TEAM_CHAT_ID)?.id ?? next[0]?.id ?? "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Chat konnte nicht verlassen werden."); }
  }

  const typingNames = [...new Set(typingIds)].map((id) => profilesById.get(id)?.name ?? "Jemand");
  const typingLabel = typingNames.length === 1 ? `${typingNames[0]} schreibt…` : typingNames.length > 1 ? `${typingNames.join(", ")} schreiben…` : "";

  const pinnedMessages = messages.filter((message) => message.pinnedAt);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <RouteGuard><AppShell title="Chat" eyebrow="Team" contentClassName="chat-page">
      <div className="chat-workspace">
        <aside className={chatListOpen ? "chat-list is-open" : "chat-list"}>
          <header><div><strong>Chats</strong><span>{conversations.reduce((sum, item) => sum + item.unreadCount, 0)} ungelesen</span></div><div className="chat-list-actions"><button className="chat-list-close" type="button" aria-label="Chatliste schließen" onClick={() => setChatListOpen(false)}><X size={18} /></button><button className="icon-button primary" type="button" aria-label="Neuen Chat oder neue Gruppe starten" onClick={() => setCreateOpen(true)}><Plus size={18} /></button></div></header>
          <div className="chat-list-search"><Search size={15} /><span>Gruppen und Direktnachrichten</span></div>
          <nav>{conversations.map((conversation) => <button className={conversation.id === activeId ? "is-active" : ""} type="button" key={conversation.id} onClick={() => selectConversation(conversation.id)}><ChatAvatar conversation={conversation} profiles={profilesById} sessionId={session?.id} /><span><strong>{conversationTitle(conversation, profilesById, session?.id)}</strong><small>{conversation.lastMessage ? conversation.lastMessage.body || `${conversation.lastMessage.attachmentCount} Datei(en)` : conversation.description || "Noch keine Nachrichten"}</small></span>{conversation.unreadCount ? <b>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</b> : null}</button>)}</nav>
        </aside>
        <section className={dragActive ? "team-chat is-dragging" : "team-chat"} aria-label={activeConversation?.name ?? "Chat"} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); void addFiles(event.dataTransfer.files); }}>
          <header className="chat-topbar">{activeConversation ? <button className="chat-topbar-details" type="button" onClick={() => setDetailsOpen(true)}><ChatAvatar conversation={activeConversation} profiles={profilesById} sessionId={session?.id} /><span><strong>{conversationTitle(activeConversation, profilesById, session?.id)}</strong><small>{activeConversation.memberIds.length} Teilnehmer</small></span><ChevronRight size={17} /></button> : <LoaderCircle className="spin" size={20} />}<button className="chat-list-toggle" type="button" aria-label="Zwischen Chats wechseln" onClick={() => setChatListOpen(true)}><MessageCircle size={20} /><span>Chats</span></button></header>
          {pinnedMessages.length ? <button className="chat-pinned-banner" type="button" onClick={() => document.getElementById(`chat-message-${pinnedMessages.at(-1)?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}><Pin size={14} /><span><strong>Angepinnte Nachricht</strong><small>{pinnedMessages.at(-1)?.body || "Datei oder Umfrage"}</small></span></button> : null}
          <div className="chat-stream" ref={streamRef} onScroll={updateJumpToLatest} onClick={() => { setOpenReaders(null); setContextMenu(null); }}>
            {loading ? <div className="chat-loading"><LoaderCircle className="spin" size={24} /> Chat wird geladen...</div> : null}
            {!loading && !messages.length ? <div className="chat-welcome"><MessageCircle size={25} /><strong>Noch keine Nachrichten</strong><span>Starte die Unterhaltung.</span></div> : null}
            {messages.map((message) => {
              const author = profilesById.get(message.authorId); const own = message.authorId === session?.id; const emojiOnly = !message.poll && !message.attachments.length && isEmojiOnly(message.body);
              const messageReaders = receipts.filter((receipt) => receipt.messageId === message.id);
              const readers = messageReaders.map((receipt) => profilesById.get(receipt.profileId)).filter((profile): profile is Profile => Boolean(profile));
              return <div className={["chat-message-row", own ? "is-own" : "", swiping?.id === message.id ? "is-swiping" : ""].filter(Boolean).join(" ")} id={`chat-message-${message.id}`} key={message.id} onPointerDown={(event) => { swipeStartRef.current = { id: message.id, x: event.clientX, y: event.clientY }; }} onPointerMove={(event) => { const start = swipeStartRef.current; if (start?.id === message.id && event.clientX > start.x && Math.abs(event.clientY - start.y) < 45) setSwiping({ id: message.id, offset: Math.min(event.clientX - start.x, 92) }); }} onPointerUp={(event) => { const start = swipeStartRef.current; swipeStartRef.current = null; setSwiping(null); if (start?.id === message.id && event.clientX - start.x > 72 && Math.abs(event.clientY - start.y) < 45) { setReplyingTo(message); textareaRef.current?.focus(); } }} onPointerCancel={() => { swipeStartRef.current = null; setSwiping(null); }}>
                <article className={["chat-message", own ? "is-own" : "", emojiOnly ? "is-emoji-only" : "", message.poll ? "has-poll" : "", message.attachments.some((file) => file.type.startsWith("image/")) ? "has-image" : ""].filter(Boolean).join(" ")} style={{ transform: swiping?.id === message.id ? `translateX(${swiping.offset}px)` : undefined }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ message, x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 330) }); }}>
                  <div className="chat-message-meta"><strong>{author?.name ?? "Ehemaliges Mitglied"}</strong><time>{formatMessageTime(message.createdAt)}</time>{message.editedAt ? <small>bearbeitet</small> : null}{message.pinnedAt ? <Pin size={11} /> : null}</div>
                  {message.replyTo ? <button className="chat-reply-preview" type="button" onClick={() => document.getElementById(`chat-message-${message.replyTo?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}><Reply size={13} /><span><strong>{profilesById.get(message.replyTo.authorId)?.name ?? "Nachricht"}</strong><small>{message.replyTo.body || `${message.replyTo.attachmentCount} Datei(en)`}</small></span></button> : null}
                  {message.poll ? <ChatPollCard message={message} sessionId={session?.id} profiles={profilesById} onVote={(optionId) => void togglePollVote(message, optionId)} /> : message.body ? renderMessageBody(message.body, data.events, data.profiles) : null}
                  {message.attachments.length ? <div className="chat-attachments">{message.attachments.map((file, index) => renderAttachment(file, index, setPreviewImage))}</div> : null}
                  <button className="chat-message-menu-button" type="button" aria-label="Nachrichtenaktionen" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setContextMenu({ message, x: Math.min(rect.right - 210, window.innerWidth - 220), y: Math.min(rect.bottom + 4, window.innerHeight - 330) }); }}><MoreHorizontal size={15} /></button>
                </article>
                {message.reactions.length ? <div className="chat-reactions">{message.reactions.map((reaction) => <button className={reaction.profileIds.includes(session?.id ?? "") ? "is-own-reaction" : ""} type="button" key={reaction.emoji} title={reaction.profileIds.map((id) => profilesById.get(id)?.name).filter(Boolean).join(", ")} onClick={() => void react(message, reaction.emoji)}><span>{reaction.emoji}</span>{reaction.profileIds.length}</button>)}</div> : null}
                {readers.length ? <ChatReaderAvatars readers={messageReaders} profiles={profilesById} open={openReaders === message.id} onToggle={(event) => { event.stopPropagation(); setOpenReaders((current) => current === message.id ? null : message.id); }} /> : null}
              </div>;
            })}<div ref={endRef} />
          </div>
          {showJumpToLatest ? <button className="chat-jump-latest" type="button" aria-label="Zur neuesten Nachricht" onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}><ArrowDown size={20} /></button> : null}
          <div className="chat-composer">
            {typingLabel ? <div className="chat-typing-indicator" role="status" aria-live="polite"><span className="chat-typing-dots" aria-hidden="true">•••</span>{typingLabel}</div> : null}
            {pollOpen ? <PollComposer question={pollQuestion} options={pollOptions} multiple={pollMultiple} sending={sending} onQuestion={setPollQuestion} onOptions={setPollOptions} onMultiple={setPollMultiple} onClose={() => setPollOpen(false)} onSubmit={() => void submitPoll()} /> : null}
            {replyingTo ? <div className="chat-compose-reply"><Reply size={15} /><span><strong>Antwort an {profilesById.get(replyingTo.authorId)?.name}</strong><small>{replyingTo.body || "Datei oder Umfrage"}</small></span><button type="button" aria-label="Antwort abbrechen" onClick={() => setReplyingTo(null)}><X size={16} /></button></div> : null}
            {attachments.length ? <div className="chat-upload-list">{attachments.map((file, index) => <span key={`${file.url}-${index}`}><Paperclip size={13} />{file.name}<button type="button" aria-label={`${file.name} entfernen`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button></span>)}</div> : null}
            {recording ? <div className="chat-recording-status"><span /><strong>Aufnahme läuft</strong><time>{formatRecordingTime(recordingSeconds)}</time></div> : null}{error ? <p className="error-text">{error}</p> : null}
            <div className="chat-compose-row"><textarea ref={textareaRef} value={body} onChange={(event) => updateBody(event.target.value)} placeholder="Nachricht schreiben..." rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} /><div className="chat-compose-tools"><div className="chat-add-control"><button className="icon-button chat-tool-button" type="button" aria-label="Dateien oder Abstimmung hinzufügen" aria-expanded={composeMenuOpen} onClick={() => setComposeMenuOpen((open) => !open)}><Plus size={19} /></button>{composeMenuOpen ? <div className="chat-add-menu"><label><Paperclip size={17} /><span>Datei oder Bild</span><input className="visually-hidden" type="file" multiple onChange={(event) => { if (event.currentTarget.files) void addFiles(event.currentTarget.files); event.currentTarget.value = ""; setComposeMenuOpen(false); }} /></label><button type="button" onClick={() => { setPollOpen(true); setComposeMenuOpen(false); }}><BarChart3 size={17} /><span>Abstimmung</span></button></div> : null}</div><label className="icon-button chat-tool-button" title="Foto aufnehmen"><Camera size={18} /><input className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => { if (event.currentTarget.files) void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label><button className={recording ? "icon-button chat-tool-button is-recording" : "icon-button chat-tool-button"} type="button" aria-label={recording ? "Aufnahme beenden" : "Sprachnachricht aufnehmen"} onClick={() => void toggleRecording()}>{recording ? <Square size={15} fill="currentColor" /> : <Mic size={18} />}</button><button className="icon-button primary chat-send-button" type="button" aria-label="Nachricht senden" disabled={sending || (!body.trim() && !attachments.length)} onClick={() => void submit()}>{sending ? <LoaderCircle className="spin" size={19} /> : <Send size={18} />}</button></div></div>
            {referenceQuery !== null && eventSuggestions.length ? <SuggestionList title="Veranstaltung verlinken">{eventSuggestions.map((event) => <button type="button" key={event.id} onClick={() => insertEventReference(event)}><CalendarDays size={15} /><span><strong>{event.title}</strong><small>{formatEventDate(event.startsAt)}</small></span></button>)}</SuggestionList> : null}
            {mentionQuery !== null && mentionSuggestions.length ? <SuggestionList title="Person erwähnen">{mentionSuggestions.map((profile) => <button type="button" key={profile.id} onClick={() => insertMention(profile)}><ProfileAvatar profile={profile} /><span><strong>{profile.name}</strong><small>@{profile.name}</small></span></button>)}</SuggestionList> : null}
          </div>{dragActive ? <div className="chat-drop-overlay"><Paperclip size={32} /><strong>Dateien hier ablegen</strong></div> : null}
        </section>
      </div>
      {contextMenu ? <MessageContextMenu menu={contextMenu} own={contextMenu.message.authorId === session?.id} canDelete={contextMenu.message.authorId === session?.id || isAdmin} onReact={(emoji) => void react(contextMenu.message, emoji)} onReply={() => { setReplyingTo(contextMenu.message); setContextMenu(null); textareaRef.current?.focus(); }} onCopy={() => { void navigator.clipboard.writeText(contextMenu.message.body); setContextMenu(null); }} onEdit={() => void editMessage(contextMenu.message)} onDelete={() => void removeMessage(contextMenu.message)} onPin={() => void pinMessage(contextMenu.message)} onForward={() => { setForwardMessage(contextMenu.message); setContextMenu(null); }} /> : null}
      {detailsOpen && activeConversation ? <ChatDetails conversation={activeConversation} profiles={data.profiles} sessionId={session?.id} editable={isAdmin || activeConversation.createdBy === session?.id} onClose={() => setDetailsOpen(false)} onClear={() => void clearHistory()} onLeave={() => void leaveConversation()} onSaved={async () => { await refreshConversations(); setDetailsOpen(false); }} /> : null}
      {previewImage ? <div className="chat-image-backdrop" role="presentation" onClick={() => setPreviewImage(null)}><section className="chat-image-preview" role="dialog" aria-modal="true" aria-label={previewImage.name} onClick={(event) => event.stopPropagation()}><header><strong>{previewImage.name}</strong><button type="button" aria-label="Bild schließen" onClick={() => setPreviewImage(null)}><X size={22} /></button></header><img src={previewImage.url} alt={previewImage.name} /></section></div> : null}
      {createOpen && session ? <CreateChatModal profiles={data.profiles} sessionId={session.id} conversations={conversations} onClose={() => setCreateOpen(false)} onCreated={async (id) => { await refreshConversations(); setActiveId(id); setCreateOpen(false); }} /> : null}
      {forwardMessage && session ? <PickerModal title="Weiterleiten an" conversations={conversations} profiles={profilesById} sessionId={session.id} onClose={() => setForwardMessage(null)} onPick={async (conversation) => { await forwardChatMessage(session.id, conversation.id, forwardMessage); setForwardMessage(null); setActiveId(conversation.id); await refreshConversations(); }} /> : null}
    </AppShell></RouteGuard>
  );
}

function MessageContextMenu({ menu, own, canDelete, onReact, onReply, onCopy, onEdit, onDelete, onPin, onForward }: { menu: { message: ChatMessage; x: number; y: number }; own: boolean; canDelete: boolean; onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void; onEdit: () => void; onDelete: () => void; onPin: () => void; onForward: () => void }) { return <div className="chat-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}><div className="chat-quick-reactions">{QUICK_REACTIONS.map((emoji) => <button type="button" key={emoji} onClick={() => onReact(emoji)}>{emoji}</button>)}</div><button type="button" onClick={onReply}><Reply size={16} />Antworten</button><button type="button" onClick={() => onReact("👍")}><SmilePlus size={16} />Reagieren</button><button type="button" onClick={onCopy}><Copy size={16} />Kopieren</button><button type="button" onClick={onPin}>{menu.message.pinnedAt ? <PinOff size={16} /> : <Pin size={16} />}{menu.message.pinnedAt ? "Lösen" : "Anpinnen"}</button><button type="button" onClick={onForward}><Forward size={16} />Weiterleiten</button>{own && menu.message.body ? <button type="button" onClick={onEdit}><Pencil size={16} />Bearbeiten</button> : null}{canDelete ? <button className="is-danger" type="button" onClick={onDelete}><Trash2 size={16} />Löschen</button> : null}</div>; }

function ChatDetails({ conversation, profiles, sessionId, editable, onClose, onClear, onLeave, onSaved }: { conversation: ChatConversation; profiles: Profile[]; sessionId?: string; editable: boolean; onClose: () => void; onClear: () => void; onLeave: () => void; onSaved: () => void }) {
  const [name, setName] = useState(conversation.name); const [description, setDescription] = useState(conversation.description); const [imageUrl, setImageUrl] = useState(conversation.imageUrl ?? ""); const [memberIds, setMemberIds] = useState(conversation.memberIds); const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  async function upload(file?: File) { if (!file) return; setUploading(true); try { setImageUrl(await uploadAppMedia(file, "chat")); } catch (caught) { setError(caught instanceof Error ? caught.message : "Bild konnte nicht hochgeladen werden."); } finally { setUploading(false); } }
  async function save() { setSaving(true); setError(""); try { await updateChatConversation(conversation.id, { name, description, imageUrl, memberIds }); onSaved(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Chatdetails konnten nicht gespeichert werden."); } finally { setSaving(false); } }
  return <div className="chat-modal-backdrop" onClick={onClose}><section className="chat-details-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header><div><Info size={19} /><strong>Chatdetails</strong></div><button type="button" onClick={onClose}><X size={19} /></button></header><div className="chat-details-content"><div className="chat-details-hero"><span>{imageUrl ? <img src={imageUrl} alt="" /> : <Users size={30} />}</span>{editable && conversation.kind === "group" ? <label className="button"><Upload size={15} />{uploading ? "Wird geladen…" : "Gruppenbild ändern"}<input className="visually-hidden" type="file" accept="image/*" onChange={(event) => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label> : null}</div><label><span>Name</span><input value={name} disabled={!editable || conversation.kind === "direct"} onChange={(event) => setName(event.target.value)} /></label><label><span>Beschreibung</span><textarea value={description} disabled={!editable || conversation.kind === "direct"} onChange={(event) => setDescription(event.target.value)} rows={3} /></label><div className="chat-members"><strong>{conversation.memberIds.length} Teilnehmer</strong>{profiles.filter((profile) => conversation.memberIds.includes(profile.id) || (editable && conversation.kind === "group")).map((profile) => <label key={profile.id}><ProfileAvatar profile={profile} /><span><strong>{profile.name}</strong><small>{profile.role === "admin" ? "Admin" : "Techniker"}</small></span>{editable && conversation.kind === "group" ? <input type="checkbox" checked={memberIds.includes(profile.id)} disabled={profile.id === sessionId} onChange={(event) => setMemberIds((current) => event.target.checked ? [...current, profile.id] : current.filter((id) => id !== profile.id))} /> : null}</label>)}</div>{error ? <p className="error-text">{error}</p> : null}</div><footer className="chat-details-actions">{conversation.kind === "direct" ? <button className="button" type="button" onClick={onClear}>Verlauf nur für mich ausblenden</button> : editable ? <button className="button primary" type="button" disabled={saving || uploading || !name.trim()} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Speichern</button> : null}{conversation.id !== TEAM_CHAT_ID ? <button className="button danger" type="button" onClick={onLeave}><Trash2 size={16} />Chat verlassen</button> : null}</footer></section></div>;
}

function CreateChatModal({ profiles, sessionId, conversations, onClose, onCreated }: { profiles: Profile[]; sessionId: string; conversations: ChatConversation[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [memberIds, setMemberIds] = useState<string[]>([]); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const group = memberIds.length > 1;
  function toggleMember(profileId: string) {
    const next = memberIds.includes(profileId) ? memberIds.filter((id) => id !== profileId) : [...memberIds, profileId];
    setMemberIds(next);
    if (next.length > 1 && !name.trim()) setName(next.map((id) => profiles.find((profile) => profile.id === id)?.name).filter(Boolean).join(" & "));
    if (next.length < 2) { setName(""); setDescription(""); }
  }
  async function create() { const members = memberIds.filter((id) => id !== sessionId); if (!members.length || (group && !name.trim())) return; if (!group) { const existing = conversations.find((conversation) => conversation.kind === "direct" && conversation.memberIds.length === 2 && conversation.memberIds.includes(sessionId) && conversation.memberIds.includes(members[0])); if (existing) { onCreated(existing.id); return; } } setSaving(true); try { const other = profiles.find((profile) => profile.id === members[0]); const id = await createChatConversation(sessionId, group ? name : other?.name ?? "Direktchat", description, group ? "group" : "direct", group ? members : members.slice(0, 1)); onCreated(id); } catch (caught) { setError(caught instanceof Error ? caught.message : "Chat konnte nicht erstellt werden."); } finally { setSaving(false); } }
  return <div className="chat-modal-backdrop" onClick={onClose}><section className="chat-create-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header><div><MessageCircle size={19} /><strong>Neuer Chat</strong></div><button type="button" onClick={onClose}><X size={19} /></button></header><div className="chat-create-content">{group ? <><label><span>Gruppenname</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Gruppennamen eingeben" /></label><label><span>Beschreibung (optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label></> : null}<div className="chat-members"><strong>{group ? `${memberIds.length} Personen ausgewählt` : "Personen auswählen – mehrere für eine Gruppe"}</strong>{profiles.filter((profile) => profile.id !== sessionId).map((profile) => <label key={profile.id}><ProfileAvatar profile={profile} /><span><strong>{profile.name}</strong><small>{profile.email}</small></span><input type="checkbox" checked={memberIds.includes(profile.id)} onChange={() => toggleMember(profile.id)} /></label>)}</div>{error ? <p className="error-text">{error}</p> : null}</div><footer><button className="button primary" type="button" disabled={saving || !memberIds.length || (group && !name.trim())} onClick={() => void create()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}{group ? "Gruppe erstellen" : "Chat starten"}</button></footer></section></div>;
}

function PickerModal({ title, conversations, profiles, sessionId, onClose, onPick }: { title: string; conversations: ChatConversation[]; profiles: Map<string, Profile>; sessionId: string; onClose: () => void; onPick: (conversation: ChatConversation) => void }) { return <div className="chat-modal-backdrop" onClick={onClose}><section className="chat-picker-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header><strong>{title}</strong><button type="button" onClick={onClose}><X size={19} /></button></header><div>{conversations.map((conversation) => <button type="button" key={conversation.id} onClick={() => onPick(conversation)}><ChatAvatar conversation={conversation} profiles={profiles} sessionId={sessionId} /><span><strong>{conversationTitle(conversation, profiles, sessionId)}</strong><small>{conversation.description}</small></span><Forward size={16} /></button>)}</div></section></div>; }
function SuggestionList({ title, children }: { title: string; children: React.ReactNode }) { return <div className="chat-event-suggestions"><span>{title}</span>{children}</div>; }
function PollComposer({ question, options, multiple, sending, onQuestion, onOptions, onMultiple, onClose, onSubmit }: { question: string; options: string[]; multiple: boolean; sending: boolean; onQuestion: (value: string) => void; onOptions: (value: string[]) => void; onMultiple: (value: boolean) => void; onClose: () => void; onSubmit: () => void }) { return <section className="chat-poll-composer"><header><div><BarChart3 size={18} /><strong>Umfrage erstellen</strong></div><button type="button" onClick={onClose}><X size={17} /></button></header><input value={question} onChange={(event) => onQuestion(event.target.value)} placeholder="Frage" autoFocus /><div className="chat-poll-option-inputs">{options.map((option, index) => <label key={index}><span>{index + 1}</span><input value={option} onChange={(event) => onOptions(options.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Antwort ${index + 1}`} />{options.length > 2 ? <button type="button" onClick={() => onOptions(options.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button> : null}</label>)}</div><div className="chat-poll-actions"><button className="button ghost" type="button" disabled={options.length >= 8} onClick={() => onOptions([...options, ""])}><Plus size={15} /> Antwort</button><label><input type="checkbox" checked={multiple} onChange={(event) => onMultiple(event.target.checked)} /> Mehrfachauswahl</label><button className="button primary" type="button" disabled={sending || !question.trim() || options.filter((option) => option.trim()).length < 2} onClick={onSubmit}>Senden</button></div></section>; }
function ChatPollCard({ message, sessionId, profiles, onVote }: { message: ChatMessage; sessionId?: string; profiles: Map<string, Profile>; onVote: (optionId: string) => void }) { const poll = message.poll; if (!poll) return null; const totalVotes = poll.options.reduce((sum, option) => sum + option.voterIds.length, 0); const participantCount = new Set(poll.options.flatMap((option) => option.voterIds)).size; return <div className="chat-poll"><strong>{poll.question}</strong><div>{poll.options.map((option) => { const selected = Boolean(sessionId && option.voterIds.includes(sessionId)); const percent = totalVotes ? Math.round(option.voterIds.length / totalVotes * 100) : 0; return <div className="chat-poll-result" key={option.id}><button className={selected ? "is-selected" : ""} type="button" onClick={() => onVote(option.id)}><span className="chat-poll-fill" style={{ width: `${percent}%` }} /><span className="chat-poll-choice"><i>{selected ? "✓" : ""}</i><b>{option.label}</b><small>{option.voterIds.length}</small></span></button><div className="chat-poll-voter-list">{option.voterIds.map((id) => { const voter = profiles.get(id); return voter ? <span key={id}>{voter.avatarUrl ? <img src={voter.avatarUrl} alt="" /> : <i>{initials(voter.name)}</i>}{voter.name}</span> : null; })}{!option.voterIds.length ? <small>Noch keine Stimmen</small> : null}</div></div>; })}</div><small>{participantCount} {participantCount === 1 ? "Stimme" : "Stimmen"}{poll.allowMultiple ? " · Mehrfachauswahl" : ""}</small></div>; }
function ChatReaderAvatars({ readers, profiles, open, onToggle }: { readers: ChatReadReceipt[]; profiles: Map<string, Profile>; open: boolean; onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void }) { const visibleReaders = readers.map((receipt) => ({ receipt, profile: profiles.get(receipt.profileId) })).filter((item): item is { receipt: ChatReadReceipt; profile: Profile } => Boolean(item.profile)); return <div className="chat-read-status"><button type="button" aria-label={`Gelesen von ${visibleReaders.length} Personen`} aria-expanded={open} onClick={onToggle}>{visibleReaders.slice(0, 4).map(({ profile }) => <span className="chat-reader-avatar" key={profile.id}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile.name)}</span>)}{visibleReaders.length > 4 ? <span className="chat-reader-more">+{visibleReaders.length - 4}</span> : null}</button>{open ? <div className="chat-reader-popover"><strong>Gelesen von</strong>{visibleReaders.map(({ receipt, profile }) => <span key={profile.id}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <i>{initials(profile.name)}</i>}<span>{profile.name}<small>{formatReceiptTime(receipt.readAt)}</small></span></span>)}</div> : null}</div>; }
function ChatAvatar({ conversation, profiles, sessionId }: { conversation: ChatConversation; profiles: Map<string, Profile>; sessionId?: string }) { const other = conversation.kind === "direct" ? profiles.get(conversation.memberIds.find((id) => id !== sessionId) ?? "") : undefined; const image = conversation.imageUrl || other?.avatarUrl; return <span className="chat-avatar">{image ? <img src={image} alt="" /> : conversation.kind === "direct" ? initials(other?.name ?? conversation.name) : <Users size={18} />}</span>; }
function ProfileAvatar({ profile }: { profile: Profile }) { return <span className="chat-profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile.name)}</span>; }
function conversationTitle(conversation: ChatConversation, profiles: Map<string, Profile>, sessionId?: string) { if (conversation.kind !== "direct") return conversation.name; return profiles.get(conversation.memberIds.find((id) => id !== sessionId) ?? "")?.name ?? conversation.name; }

function renderMessageBody(body: string, events: Event[], profiles: Profile[]) { const names = profiles.map((profile) => profile.name).sort((a, b) => b.length - a.length).map(escapeRegExp); const pattern = new RegExp(`(\\[\\[[^\\]]+\\]\\]|\\[[^\\[\\]]+\\]${names.length ? `|@(?:${names.join("|")})` : ""})`, "gi"); return <p>{body.split(pattern).filter(Boolean).map((part, index) => { if (part.startsWith("[") && part.endsWith("]")) { const title = part.startsWith("[[") ? part.slice(2, -2) : part.slice(1, -1); const event = events.find((item) => item.title.toLocaleLowerCase("de") === title.trim().toLocaleLowerCase("de")); return event ? <Link className="chat-event-link" href={`/calendar?event=${encodeURIComponent(event.id)}`} key={`${part}-${index}`}><CalendarDays size={14} />{event.title}</Link> : part; } const profile = part.startsWith("@") ? profiles.find((item) => `@${item.name}`.toLocaleLowerCase("de") === part.toLocaleLowerCase("de")) : undefined; return profile ? <span className="chat-mention" key={`${part}-${index}`}>@{profile.name}</span> : part; })}</p>; }
function ChatImageAttachment({ file, onPreview }: { file: AttachmentFile; onPreview: (file: AttachmentFile) => void }) {
  const touchRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  return <button type="button" className="chat-image" aria-label={`${file.name} vergrößern`}
    onTouchStart={(event) => { const touch = event.touches[0]; touchRef.current = { x: touch.clientX, y: touch.clientY, moved: false }; suppressClickRef.current = false; }}
    onTouchMove={(event) => { const start = touchRef.current; const touch = event.touches[0]; if (start && touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8) { start.moved = true; suppressClickRef.current = true; } }}
    onTouchEnd={(event) => { const start = touchRef.current; touchRef.current = null; if (!start || start.moved) return; event.preventDefault(); event.stopPropagation(); onPreview(file); }}
    onClick={(event) => { event.stopPropagation(); if (suppressClickRef.current) { suppressClickRef.current = false; return; } onPreview(file); }}>
    <img src={file.url} alt={file.name} /><span><ImageIcon size={14} />{file.name}</span>
  </button>;
}
function renderAttachment(file: AttachmentFile, index: number, onPreview: (file: AttachmentFile) => void) { if (file.type.startsWith("image/")) return <ChatImageAttachment key={`${file.url}-${index}`} file={file} onPreview={onPreview} />; if (file.type.startsWith("video/")) return <div className="chat-video" key={`${file.url}-${index}`}><video src={file.url} controls playsInline /><span><Film size={14} />{file.name}</span></div>; if (file.type.startsWith("audio/")) return <div className="chat-audio" key={`${file.url}-${index}`}><audio src={file.url} controls preload="metadata" /><span><Mic size={14} />Sprachnachricht</span></div>; return <a href={file.url} target="_blank" rel="noreferrer" download={file.name} key={`${file.url}-${index}`}><FileText size={16} />{file.name}</a>; }
function eventReferenceQuery(value: string) { const match = value.match(/\[{1,2}([^\[\]\n]*)$/); return match ? match[1] : null; }
function personMentionQuery(value: string) { const match = value.match(/(?:^|\s)@([^@\n]*)$/); return match ? match[1] : null; }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function isEmojiOnly(value: string) { const trimmed = value.trim(); return Boolean(trimmed) && trimmed.length <= 32 && /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u.test(trimmed); }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }
function formatMessageTime(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatReceiptTime(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatEventDate(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatRecordingTime(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; }
