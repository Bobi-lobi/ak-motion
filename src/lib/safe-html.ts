import DOMPurify from "isomorphic-dompurify";

// Stored editor content is untrusted, including content loaded from older pages.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") node.setAttribute("rel", "noopener noreferrer");
  if (node.tagName === "IFRAME") {
    try {
      const url = new URL(node.getAttribute("src") ?? "");
      const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local");
      if (url.origin !== storage.origin || !url.pathname.startsWith("/storage/v1/object/public/")) { node.remove(); return; }
      node.setAttribute("sandbox", "allow-same-origin");
      node.setAttribute("referrerpolicy", "no-referrer");
    } catch { node.remove(); }
  }
});

export function safeHtml(value: string) {
  return DOMPurify.sanitize(value, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "contenteditable"],
    FORBID_TAGS: ["svg", "math", "form", "input", "button", "style"],
    FORBID_ATTR: ["srcdoc"]
  });
}
