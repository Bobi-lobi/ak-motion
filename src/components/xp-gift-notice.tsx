"use client";

import { Gift, Undo2, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { XpGiftEvent } from "@/lib/types";

export function XpGiftNotice({ event, messageId, createdAt, isAdmin, onReverted }: {
  event: XpGiftEvent; messageId: string; createdAt: string; isAdmin: boolean; onReverted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  async function undo() {
    if (!supabase || busy) return;
    setBusy(true); setError("");
    try {
      const { error } = await supabase.rpc("revoke_xp_gift", { message_id: messageId });
      if (error) throw error;
      window.dispatchEvent(new Event("ak-motion-data"));
      await onReverted();
      setConfirming(false);
    } catch { setError("Das Punktegeschenk konnte nicht zurückgenommen werden. Bitte erneut versuchen."); }
    finally { setBusy(false); }
  }
  const revoked = Boolean(event.revokedAt);
  return <article id={`chat-message-${messageId}`} className={`xp-gift-notice${revoked ? " is-revoked" : ""}`} aria-label="Punktegeschenk">
    <div className="xp-gift-symbol" aria-hidden="true">{revoked ? <Check size={20} /> : <Gift size={22} />}</div>
    <div className="xp-gift-content"><header><span>Wertschätzung im Team</span><time dateTime={createdAt}>{new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt))}</time></header>
      <p><strong>{event.adminName}</strong> hat <strong>{event.recipientName}</strong> <b>{event.amount.toLocaleString("de-DE")} Punkte</b> geschenkt.</p>
      {revoked ? <small className="xp-gift-revoked">Punktegeschenk zurückgenommen</small> : isAdmin ? <div className="xp-gift-actions">{confirming ? <><span>Punkte wirklich zurücknehmen?</span><button type="button" disabled={busy} onClick={() => void undo()}>{busy ? "Wird zurückgenommen …" : "Ja, zurücknehmen"}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)}>Abbrechen</button></> : <button type="button" onClick={() => setConfirming(true)}><Undo2 size={13} />Rückgängig machen</button>}</div> : null}
      {error ? <small className="error-text" role="alert">{error}</small> : null}
    </div>
  </article>;
}
