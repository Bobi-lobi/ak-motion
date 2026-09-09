import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#121212",
    description: "Kalender und Einsatzplanung für das AK-Motion Technikteam",
    display: "standalone",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/ak-motion-logo.png", sizes: "512x512", type: "image/png" }
    ],
    name: "AK-Motion",
    short_name: "Motion",
    start_url: "/calendar",
    theme_color: "#121212"
  };
}
