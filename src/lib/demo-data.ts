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
  ]
};

export const demoPasswords: Record<string, string> = {
  "admin@ak-motion.local": "admin123",
  "mara@ak-motion.local": "technik123",
  "jonas@ak-motion.local": "technik123",
  "nora@ak-motion.local": "technik123"
};
