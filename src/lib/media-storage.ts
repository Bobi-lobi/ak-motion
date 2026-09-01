import { supabase } from "@/lib/supabase";

const APP_MEDIA_BUCKET = "app-media";

export async function uploadAppMedia(file: File, scope: "editor" | "profile") {
  if (!supabase) {
    return fileToDataUrl(file);
  }

  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || extensionForMime(file.type);
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "datei";
  const objectPath = `${scope}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}.${extension}`;
  const { error } = await supabase.storage.from(APP_MEDIA_BUCKET).upload(objectPath, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(storageErrorMessage(error.message));
  }

  return supabase.storage.from(APP_MEDIA_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function extensionForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "video/quicktime") return "mov";
  return mime.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
}

function storageErrorMessage(message: string) {
  if (/bucket not found/i.test(message)) {
    return "Der NAS-Speicher für App-Medien ist noch nicht eingerichtet.";
  }
  if (/row-level security|permission|policy/i.test(message)) {
    return "Die Datei darf nicht in den NAS-Speicher hochgeladen werden.";
  }
  return `Datei konnte nicht gespeichert werden: ${message}`;
}
