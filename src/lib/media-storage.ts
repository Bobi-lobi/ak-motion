import { supabase } from "@/lib/supabase";

const APP_MEDIA_BUCKET = "app-media";

export async function uploadAppMedia(file: File, scope: "chat" | "editor" | "profile") {
  const uploadFile = scope === "profile" ? await prepareProfileImage(file) : file;
  if (!supabase) {
    return fileToDataUrl(uploadFile);
  }

  const extension = uploadFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || extensionForMime(uploadFile.type);
  const safeName = uploadFile.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "datei";
  const objectPath = `${scope}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}.${extension}`;
  const { error } = await supabase.storage.from(APP_MEDIA_BUCKET).upload(objectPath, uploadFile, {
    cacheControl: "31536000",
    contentType: uploadFile.type,
    upsert: false
  });

  if (error) {
    throw new Error(storageErrorMessage(error.message));
  }

  return supabase.storage.from(APP_MEDIA_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

async function prepareProfileImage(file: File) {
  const imageExtension = /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
  if (!file.type.startsWith("image/") && !imageExtension) {
    throw new Error("Bitte wähle eine Bilddatei aus.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Das Profilbild darf höchstens 20 MB groß sein.");
  }

  const source = await loadImage(file);
  const maxEdge = 1024;
  const scale = Math.min(1, maxEdge / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Das Profilbild konnte nicht verarbeitet werden.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Das Profilbild konnte nicht verarbeitet werden.");
  return new File([blob], "profilbild.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Dieses Bildformat konnte nicht gelesen werden."));
    };
    image.src = url;
  });
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
