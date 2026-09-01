import { supabase } from "@/lib/supabase";

const LANDING_BUCKET = "landing-images";

export async function uploadLandingImage(file: File | Blob, fileName?: string) {
  if (!supabase) {
    return blobToDataUrl(file);
  }

  const compressed = await compressImage(file);
  const extension = compressed.type === "image/webp" ? "webp" : "jpg";
  const sourceName = fileName ?? (file instanceof File ? file.name : "landing-image");
  const safeName = sourceName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "bild";
  const objectPath = `landing/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}.${extension}`;
  const { error } = await supabase.storage.from(LANDING_BUCKET).upload(objectPath, compressed, {
    contentType: compressed.type,
    cacheControl: "31536000",
    upsert: false
  });

  if (error) {
    throw new Error(storageErrorMessage(error.message));
  }

  const { data } = supabase.storage.from(LANDING_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function migrateLandingImage(image: string) {
  if (!image.startsWith("data:image/")) {
    return image;
  }

  const response = await fetch(image);
  const blob = await response.blob();
  return uploadLandingImage(blob, "bestehendes-bild");
}

async function compressImage(file: File | Blob) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Bild konnte nicht verarbeitet werden.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas, "image/webp", 0.78);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Bild konnte nicht komprimiert werden."));
      }
    }, type, quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

function storageErrorMessage(message: string) {
  if (/bucket not found/i.test(message)) {
    return "Der Supabase-Storage-Bucket 'landing-images' fehlt. Bitte zuerst die neue Storage-Migration ausführen.";
  }
  if (/row-level security|permission|policy/i.test(message)) {
    return "Das Bild darf nicht gespeichert werden. Bitte die Storage-Richtlinien auf dem Supabase-Server einspielen.";
  }
  return `Bild konnte nicht gespeichert werden: ${message}`;
}
