import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AK-Motion",
  description: "Kalender und Einsatzplanung für Schultechnikteams"
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
