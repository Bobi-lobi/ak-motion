"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { dismissUpload, getServerUploads, getUploads, subscribeUploads } from "@/lib/storage-upload";

export function UploadProgress({ inline = false }: { inline?: boolean }) {
  const pathname = usePathname();
  const uploads = useSyncExternalStore(subscribeUploads, getUploads, getServerUploads);
  if (!uploads.length || (!inline && pathname === "/chat")) return null;
  return <aside className={inline ? "upload-progress-panel is-inline" : "upload-progress-panel"} aria-label="Datei-Uploads">{uploads.map((upload) => <div className="upload-progress-item" key={upload.id}>
    <header><strong title={upload.name}>{upload.name}</strong>{upload.state === "done" || upload.state === "error" ? <button type="button" aria-label="Uploadanzeige schließen" onClick={() => dismissUpload(upload.id)}><X size={16} /></button> : <span>{upload.percent} %</span>}</header>
    <progress aria-label={`Upload von ${upload.name}`} max={100} value={upload.percent} />
    <small role={upload.state === "error" ? "alert" : undefined}>{upload.state === "error" ? upload.error : upload.state === "done" ? "Hochgeladen · 100 %" : upload.state === "saving" ? "Übertragen · Wird gespeichert …" : "Wird hochgeladen …"}</small>
  </div>)}</aside>;
}
