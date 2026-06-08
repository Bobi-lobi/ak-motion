import type { AppData } from "@/lib/types";

export const demoData: AppData = {
  profiles: [
    {
      id: "admin-1",
      name: "Teamleitung",
      email: "admin@ak-motion.local",
      role: "admin",
      createdAt: "2026-05-01T10:00:00.000Z"
    },
    {
      id: "tech-1",
      name: "Mara Ton",
      email: "mara@ak-motion.local",
      role: "technician",
      createdAt: "2026-05-02T10:00:00.000Z"
    },
    {
      id: "tech-2",
      name: "Jonas Licht",
      email: "jonas@ak-motion.local",
      role: "technician",
      createdAt: "2026-05-02T10:15:00.000Z"
    },
    {
      id: "tech-3",
      name: "Nora Umbau",
      email: "nora@ak-motion.local",
      role: "technician",
      createdAt: "2026-05-02T10:30:00.000Z"
    }
  ],
  registrationRequests: [],
  landingContent: {
    brandTitle: "Motion",
    heroKicker: "AK-Technik",
    heroTitle: "Wir machen Veranstaltungen sichtbar, hörbar und zuverlässig.",
    heroText: "Ton, Licht, Bühne, Umbau und Planung für alles, was an der Schule nach mehr als nur Klassenzimmer klingt.",
    primaryButtonText: "Mitglied werden",
    requestButtonText: "Veranstaltung anfragen",
    stats: [
      { id: "events", label: "Veranstaltungen", suffix: "+" },
      { id: "lamps", label: "Lampen", suffix: "+" },
      { id: "technicians", label: "Techniker", suffix: "+" },
      { id: "equipment", label: "Equipment-Teile", suffix: "+" }
    ],
    impressionsKicker: "Eindrücke",
    impressionsTitle: "Momente aus Veranstaltungen",
    teamKicker: "Team",
    teamTitle: "Menschen hinter dem Mischpult",
    requestKicker: "Veranstaltung planen",
    requestTitle: "Du brauchst Technik für eine Veranstaltung?",
    requestText: "Fülle kurz das Formular aus. Die Teamleitung prüft deine Anfrage und übernimmt passende Termine in den Veranstaltungskalender.",
    requestCta: "Anfrageformular öffnen",
    joinTitle: "Du willst mitmachen?",
    joinText:
      "Wir suchen Schüler, die Lust auf Technik, Verantwortung und echte Veranstaltungen haben. Keine Vorerfahrung nötig, nur Neugier und Zuverlässigkeit. Hast du Interesse? Dann komm doch gerne am Freitag um 13:00 Uhr in die Aula!",
    eventImages: [
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=700&q=80",
      "https://images.unsplash.com/photo-1522158637959-30385a09e0da?auto=format&fit=crop&w=700&q=80"
    ],
    teamImage: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
    teamNames: ["Mara", "Jonas", "Nora", "Max"],
    impressions: [
      {
        id: "impression-1",
        title: "Sommerkonzert",
        text: "Lichtstimmungen, Funkmikrofone und ein voller Saal. Genau die Art Abend, bei dem Technik leise glänzen darf.",
        images: [
          "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80"
        ]
      },
      {
        id: "impression-2",
        title: "Theaterabend",
        text: "Umbauten, Cues und präzise Lichtwechsel für eine Bühne, die sich lebendig anfühlt.",
        images: [
          "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=900&q=80"
        ]
      }
    ]
  },
  requests: [
    {
      id: "request-1",
      title: "Sommerkonzert Unterstufe",
      startsAt: "2026-06-18T17:30:00.000+02:00",
      endsAt: "2026-06-18T20:30:00.000+02:00",
      location: "Aula",
      contactName: "Frau Berger",
      contactEmail: "berger@schule.local",
      eventType: "Konzert",
      techNeeds: "2 Funkmikrofone, Bühnenlicht, Aufnahme optional",
      notes: "Generalprobe am Vortag ab 14 Uhr.",
      status: "pending",
      createdAt: "2026-05-18T09:00:00.000Z"
    }
  ],
  events: [
    {
      id: "event-1",
      title: "Abiturverleihung",
      startsAt: "2026-06-28T14:00:00.000+02:00",
      endsAt: "2026-06-28T18:00:00.000+02:00",
      location: "Aula",
      eventType: "Feier",
      status: "Nicht begonnen",
      contactName: "Oberstufenkoordination",
      contactEmail: "abi@schule.local",
      microphoneCount: 4,
      techNeeds: "Rednerpult, 4 Mikrofone, Präsentation, Lichtstimmungen",
      notes: "Einlass 13:30 Uhr, Aufbau ab 10:00 Uhr.",
      createdAt: "2026-05-10T10:00:00.000Z"
    },
    {
      id: "event-2",
      title: "Theaterprobe",
      startsAt: "2026-05-25T13:00:00.000+02:00",
      endsAt: "2026-05-25T16:00:00.000+02:00",
      location: "Bühne",
      eventType: "Probe",
      status: "Nicht begonnen",
      contactName: "Theater AG",
      contactEmail: "theater@schule.local",
      microphoneCount: 2,
      techNeeds: "Lichtpult, 2 Headsets, Umbauhilfe",
      notes: "Szenenwechsel testen.",
      createdAt: "2026-05-09T10:00:00.000Z"
    }
  ],
  availability: [
    {
      id: "availability-1",
      eventId: "event-1",
      profileId: "tech-1",
      status: "committed",
      updatedAt: "2026-05-13T14:00:00.000Z"
    },
    {
      id: "availability-2",
      eventId: "event-1",
      profileId: "tech-2",
      status: "backup",
      updatedAt: "2026-05-14T14:00:00.000Z"
    }
  ],
  assignments: [
    {
      id: "assignment-1",
      eventId: "event-1",
      profileId: "tech-1",
      role: "Ton",
      createdAt: "2026-05-15T14:00:00.000Z"
    },
    {
      id: "assignment-2",
      eventId: "event-1",
      profileId: "tech-2",
      role: "Licht",
      createdAt: "2026-05-15T14:05:00.000Z"
    }
  ],
  attendance: [
    {
      id: "attendance-1",
      eventId: "event-2",
      profileId: "tech-2",
      role: "Licht",
      attended: true,
      createdAt: "2026-05-25T16:15:00.000Z"
    },
    {
      id: "attendance-2",
      eventId: "event-2",
      profileId: "tech-3",
      role: "Umbau",
      attended: true,
      createdAt: "2026-05-25T16:20:00.000Z"
    }
  ],
  knowledgePages: [
    {
      id: "rules",
      title: "Regeln",
      content: "",
      updatedAt: "2026-05-01T10:00:00.000Z"
    },
    {
      id: "guides",
      title: "Anleitungen",
      content: "",
      updatedAt: "2026-05-01T10:00:00.000Z"
    },
    {
      id: "tech-bible",
      title: "Technik Bibel",
      content: "",
      updatedAt: "2026-05-01T10:00:00.000Z"
    },
    {
      id: "ideas",
      title: "Ideenwerkstatt",
      content: "",
      updatedAt: "2026-05-01T10:00:00.000Z"
    }
  ],
  knowledgeSuggestions: []
};

export const demoPasswords: Record<string, string> = {
  "admin@ak-motion.local": "admin123",
  "mara@ak-motion.local": "technik123",
  "jonas@ak-motion.local": "technik123",
  "nora@ak-motion.local": "technik123"
};
