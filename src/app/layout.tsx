import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AK-Motion",
  description: "Kalender und Einsatzplanung für Schultechnikteams",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
      { url: "/ak-motion-logo.png", type: "image/png" }
    ],
    shortcut: "/favicon.ico",
    apple: "/ak-motion-logo.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
