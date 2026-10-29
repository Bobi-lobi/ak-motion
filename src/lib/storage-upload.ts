import { supabase } from "@/lib/supabase";

export type UploadStatus = { id: string; name: string; percent: number; state: "uploading" | "saving" | "done" | "error"; error?: string };
let uploads: UploadStatus[] = [];
const emptyUploads: UploadStatus[] = [];
const listeners = new Set<() => void>();
export const getUploads = () => uploads;
export const getServerUploads = () => emptyUploads;
export function subscribeUploads(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function updateUpload(upload: UploadStatus) {
  uploads = [...uploads.filter((item) => item.id !== upload.id), upload];
  listeners.forEach((listener) => listener());
}
export function dismissUpload(id: string) {
  uploads = uploads.filter((item) => item.id !== id);
  listeners.forEach((listener) => listener());
}

/** Upload directly to NAS storage using the signed-in user's existing permissions. */
export async function uploadStorageFile(bucket: string, path: string, file: Blob, name: string) {
  if (!supabase) throw new Error("Keine Verbindung zum Dateispeicher.");
  const id = crypto.randomUUID();
  const report = (percent: number, state: UploadStatus["state"], error?: string) => updateUpload({ id, name, percent, state, error });
  report(0, "uploading");
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error("Bitte melde dich erneut an, um Dateien hochzuladen.");
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", url);
      request.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
      request.setRequestHeader("Authorization", `Bearer ${data.session!.access_token}`);
      request.setRequestHeader("x-upsert", "false");
      request.timeout = 30 * 60 * 1000;
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) report(Math.min(99, Math.floor(event.loaded / event.total * 100)), "uploading");
      };
      request.upload.onload = () => report(99, "saving");
      request.onerror = () => reject(new Error("Netzwerkfehler beim Hochladen. Bitte prüfe deine Verbindung."));
      request.ontimeout = () => reject(new Error("Zeitüberschreitung beim Hochladen. Bitte versuche es erneut."));
      request.onabort = () => reject(new Error("Upload abgebrochen."));
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) { resolve(); return; }
        let message = `Upload fehlgeschlagen (HTTP ${request.status}).`;
        try { const result = JSON.parse(request.responseText); message = result.message || result.error || message; } catch { /* Keep bounded, non-HTML fallback. */ }
        reject(new Error(message));
      };
      const form = new FormData();
      form.append("cacheControl", "31536000");
      form.append("", file, name);
      request.send(form);
    });
    report(100, "done");
    setTimeout(() => dismissUpload(id), 4000);
  } catch (error) {
    report(getUploads().find((item) => item.id === id)?.percent ?? 0, "error", error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    throw error;
  }
}
