import { BookOpen, Lightbulb, Library, ShieldCheck } from "lucide-react";
import type { KnowledgePageId } from "@/lib/types";

export const knowledgePages = [
  {
    id: "rules",
    title: "Regeln",
    eyebrow: "Verbindlich",
    href: "/rules",
    icon: ShieldCheck
  },
  {
    id: "guides",
    title: "Anleitungen",
    eyebrow: "How-to",
    href: "/guides",
    icon: BookOpen
  },
  {
    id: "tech-bible",
    title: "Technik Bibel",
    eyebrow: "Nachschlagen",
    href: "/tech-bible",
    icon: Library
  },
  {
    id: "ideas",
    title: "Ideenwerkstatt",
    eyebrow: "Mitdenken",
    href: "/ideas",
    icon: Lightbulb
  }
] as const satisfies Array<{
  id: KnowledgePageId;
  title: string;
  eyebrow: string;
  href: string;
  icon: typeof ShieldCheck;
}>;

export function getKnowledgePageDefinition(pageId: KnowledgePageId) {
  return knowledgePages.find((page) => page.id === pageId) ?? knowledgePages[0];
}
