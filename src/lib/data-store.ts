"use client";

import { demoData, demoPasswords } from "@/lib/demo-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type {
  AppData,
  AssignmentRole,
  AvailabilityStatus,
  Event as CalendarEvent,
  EventRequest,
  EventRequestInput,
  KnowledgePageId,
  LandingContent,
  Profile,
  RegistrationRequest,
  RegistrationRequestInput,
  SessionUser,
  UserRole
} from "@/lib/types";
import { knowledgePages } from "@/lib/knowledge";

const DATA_KEY = "ak-motion-data";
const SESSION_KEY = "ak-motion-session";
const PASSWORDS_KEY = "ak-motion-passwords";

function cloneData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

function normalizeData(data: AppData): AppData {
  const normalized = data as AppData;
  normalized.registrationRequests = normalized.registrationRequests ?? [];
  normalized.landingContent = normalized.landingContent ?? cloneData(demoData).landingContent;
  normalized.landingContent.eventImages = normalized.landingContent.eventImages?.length
    ? normalized.landingContent.eventImages
    : cloneData(demoData).landingContent.eventImages;
  normalized.landingContent.teamNames = normalized.landingContent.teamNames?.length
    ? normalized.landingContent.teamNames
    : cloneData(demoData).landingContent.teamNames;
  normalized.landingContent.teamNames = normalized.landingContent.teamNames.map((name) => (name === "Teamleitung" ? "Max" : name));
  if (normalized.landingContent.joinText.includes("Keine Vorerfahrung nötig") && !normalized.landingContent.joinText.includes("Freitag um 13:00 Uhr")) {
    normalized.landingContent.joinText =
      "Wir suchen Schüler, die Lust auf Technik, Verantwortung und echte Veranstaltungen haben. Keine Vorerfahrung nötig, nur Neugier und Zuverlässigkeit. Hast du Interesse? Dann komm doch gerne am Freitag um 13:00 Uhr in die Aula!";
  }
  normalized.landingContent.impressions = normalized.landingContent.impressions?.length
    ? normalized.landingContent.impressions
    : cloneData(demoData).landingContent.impressions;
  normalized.knowledgePages = normalized.knowledgePages ?? [];
  normalized.knowledgeSuggestions = normalized.knowledgeSuggestions ?? [];

  knowledgePages.forEach((page) => {
    if (!normalized.knowledgePages.some((item) => item.id === page.id)) {
      normalized.knowledgePages.push({
        id: page.id,
        title: page.title,
        content: "",
        updatedAt: now()
      });
    }
  });

  return normalized;
}

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadData(): AppData {
  if (typeof window === "undefined") {
    return cloneData(demoData);
  }

  const existing = window.localStorage.getItem(DATA_KEY);
  if (!existing) {
    const seeded = normalizeData(cloneData(demoData));
    window.localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = normalizeData(JSON.parse(existing) as AppData);
    window.localStorage.setItem(DATA_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    const seeded = normalizeData(cloneData(demoData));
    window.localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveData(data: AppData) {
  window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("ak-motion-data"));
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function saveSession(user: SessionUser | null) {
  if (!user) {
    window.localStorage.removeItem(SESSION_KEY);
  } else {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  window.dispatchEvent(new Event("ak-motion-session"));
}

function loadPasswords() {
  if (typeof window === "undefined") {
    return demoPasswords;
  }

  const raw = window.localStorage.getItem(PASSWORDS_KEY);
  if (!raw) {
    const seeded = { ...demoPasswords };
    window.localStorage.setItem(PASSWORDS_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return { ...demoPasswords, ...(JSON.parse(raw) as Record<string, string>) };
  } catch {
    const seeded = { ...demoPasswords };
    window.localStorage.setItem(PASSWORDS_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function savePassword(email: string, password: string) {
  const passwords = loadPasswords();
  passwords[email.trim().toLowerCase()] = password;
  window.localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
}

function deletePassword(email: string) {
  const passwords = loadPasswords();
  delete passwords[email.trim().toLowerCase()];
  window.localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
}

export async function login(email: string, password: string): Promise<SessionUser> {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Login fehlgeschlagen.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email, role")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      throw new Error("Kein Profil für diesen Account gefunden.");
    }

    const profileWithDetails = profile as Profile;
    const sessionUser: SessionUser = {
      id: profileWithDetails.id,
      email: profileWithDetails.email,
      name: profileWithDetails.name,
      avatarUrl: profileWithDetails.avatarUrl,
      phone: profileWithDetails.phone,
      role: profileWithDetails.role
    };
    saveSession(sessionUser);
    return sessionUser;
  }

  const normalized = email.trim().toLowerCase();
  if (loadPasswords()[normalized] !== password) {
    throw new Error("Demo-Login fehlgeschlagen. Probiere admin@ak-motion.local / admin123.");
  }

  const profile = loadData().profiles.find((item) => item.email === normalized);
  if (!profile) {
    throw new Error("Profil nicht gefunden.");
  }

  const sessionUser: SessionUser = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    phone: profile.phone,
    role: profile.role
  };
  saveSession(sessionUser);
  return sessionUser;
}

export function createPublicRequest(input: EventRequestInput) {
  const data = loadData();
  const request: EventRequest = {
    ...input,
    id: id("request"),
    status: "pending",
    createdAt: now()
  };
  data.requests.unshift(request);
  saveData(data);
  return request;
}

export function createRegistrationRequest(input: RegistrationRequestInput) {
  const data = loadData();
  const email = input.email.trim().toLowerCase();

  if (data.profiles.some((profile) => profile.email === email)) {
    throw new Error("Für diese E-Mail gibt es bereits einen Account.");
  }

  const existing = data.registrationRequests.find((request) => request.email === email && request.status === "pending");
  if (existing) {
    throw new Error("Für diese E-Mail liegt bereits eine Bewerbung vor.");
  }

  const request: RegistrationRequest = {
    id: id("registration"),
    name: input.name.trim(),
    email,
    phone: input.phone?.trim(),
    motivation: input.motivation.trim(),
    password: input.password,
    status: "pending",
    createdAt: now()
  };
  data.registrationRequests.unshift(request);
  saveData(data);
  return request;
}

export function approveRegistrationRequest(requestId: string) {
  const data = loadData();
  const request = data.registrationRequests.find((item) => item.id === requestId);
  if (!request) {
    return;
  }

  request.status = "approved";
  let profile = data.profiles.find((item) => item.email === request.email);
  if (!profile) {
    profile = {
      id: id("profile"),
      name: request.name,
      email: request.email,
      avatarUrl: "",
      phone: request.phone ?? "",
      role: "technician",
      createdAt: now()
    };
    data.profiles.push(profile);
  }
  savePassword(request.email, request.password);
  data.registrationRequests = data.registrationRequests.filter((item) => item.id !== requestId);
  saveData(data);
}

export function rejectRegistrationRequest(requestId: string) {
  const data = loadData();
  const request = data.registrationRequests.find((item) => item.id === requestId);
  if (request) {
    request.status = "rejected";
    saveData(data);
  }
}

export function deleteRegistrationRequest(requestId: string) {
  const data = loadData();
  data.registrationRequests = data.registrationRequests.filter((item) => item.id !== requestId);
  saveData(data);
}

export function approveRequest(requestId: string) {
  const data = loadData();
  const request = data.requests.find((item) => item.id === requestId);
  if (!request) {
    return;
  }

  request.status = "approved";
  const event: CalendarEvent = {
    id: id("event"),
    title: request.title,
    startsAt: request.startsAt,
    endsAt: request.endsAt,
    location: request.location,
    eventType: request.eventType,
    status: "Nicht begonnen",
    contactName: request.contactName,
    contactEmail: request.contactEmail,
    techNeeds: request.techNeeds,
    notes: `${request.notes}\nKontakt: ${request.contactName} (${request.contactEmail})`.trim(),
    requestId: request.id,
    createdAt: now()
  };
  data.events.unshift(event);
  saveData(data);
}

export function rejectRequest(requestId: string) {
  const data = loadData();
  const request = data.requests.find((item) => item.id === requestId);
  if (request) {
    request.status = "rejected";
    saveData(data);
  }
}

export function deleteRequest(requestId: string) {
  const data = loadData();
  data.requests = data.requests.filter((item) => item.id !== requestId);
  saveData(data);
}

export function createEvent(input: Omit<CalendarEvent, "id" | "createdAt">) {
  const data = loadData();
  const event: CalendarEvent = {
    ...input,
    id: id("event"),
    createdAt: now()
  };
  data.events.unshift(event);
  saveData(data);
  return event;
}

export function deleteEvent(eventId: string) {
  const data = loadData();
  data.events = data.events.filter((item) => item.id !== eventId);
  data.availability = data.availability.filter((item) => item.eventId !== eventId);
  data.assignments = data.assignments.filter((item) => item.eventId !== eventId);
  data.attendance = data.attendance.filter((item) => item.eventId !== eventId);
  saveData(data);
}

export function setAvailability(eventId: string, profileId: string, status: AvailabilityStatus) {
  const data = loadData();
  const existing = data.availability.find((item) => item.eventId === eventId && item.profileId === profileId);
  if (existing) {
    existing.status = status;
    existing.updatedAt = now();
  } else {
    data.availability.push({
      id: id("availability"),
      eventId,
      profileId,
      status,
      updatedAt: now()
    });
  }
  saveData(data);
}

export function addAssignment(eventId: string, profileId: string, role: AssignmentRole) {
  const data = loadData();
  const duplicate = data.assignments.some(
    (item) => item.eventId === eventId && item.profileId === profileId && item.role === role
  );
  if (!duplicate) {
    data.assignments.push({
      id: id("assignment"),
      eventId,
      profileId,
      role,
      createdAt: now()
    });
  }
  saveData(data);
}

export function removeAssignment(eventId: string, profileId: string, role: AssignmentRole) {
  const data = loadData();
  data.assignments = data.assignments.filter(
    (item) => !(item.eventId === eventId && item.profileId === profileId && item.role === role)
  );
  data.attendance = data.attendance.filter(
    (item) => !(item.eventId === eventId && item.profileId === profileId && item.role === role)
  );
  saveData(data);
}

export function markAttendance(eventId: string, profileId: string, role: AssignmentRole) {
  const data = loadData();
  const existing = data.attendance.find(
    (item) => item.eventId === eventId && item.profileId === profileId && item.role === role
  );
  if (existing) {
    existing.attended = !existing.attended;
  } else {
    data.attendance.push({
      id: id("attendance"),
      eventId,
      profileId,
      role,
      attended: true,
      createdAt: now()
    });
  }
  saveData(data);
}

export function updateEventNotes(eventId: string, notes: string) {
  const data = loadData();
  const event = data.events.find((item) => item.id === eventId);
  if (event) {
    event.notes = notes;
    saveData(data);
  }
}

export function updateEvent(eventId: string, patch: Partial<CalendarEvent>) {
  const data = loadData();
  const event = data.events.find((item) => item.id === eventId);
  if (event) {
    Object.assign(event, patch);
    saveData(data);
  }
}

export function updateProfile(profileId: string, patch: Partial<Pick<Profile, "avatarUrl" | "name" | "phone">>) {
  const data = loadData();
  const profile = data.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }

  Object.assign(profile, patch);
  saveData(data);

  const session = getSession();
  if (session?.id === profileId) {
    saveSession({
      ...session,
      avatarUrl: profile.avatarUrl,
      name: profile.name,
      phone: profile.phone
    });
  }
}

export function updateKnowledgePage(pageId: KnowledgePageId, content: string, user?: SessionUser | null) {
  const data = loadData();
  const page = data.knowledgePages.find((item) => item.id === pageId);
  if (!page) {
    return;
  }

  page.content = content;
  page.updatedAt = now();
  page.updatedBy = user?.name;
  saveData(data);
}

export function createKnowledgeSuggestion(pageId: KnowledgePageId, content: string, user: SessionUser) {
  const data = loadData();
  data.knowledgeSuggestions.unshift({
    id: id("suggestion"),
    pageId,
    content,
    authorId: user.id,
    authorName: user.name,
    createdAt: now()
  });
  saveData(data);
}

export function deleteKnowledgeSuggestion(suggestionId: string) {
  const data = loadData();
  data.knowledgeSuggestions = data.knowledgeSuggestions.filter((item) => item.id !== suggestionId);
  saveData(data);
}

export function acceptKnowledgeSuggestion(suggestionId: string, user?: SessionUser | null) {
  const data = loadData();
  const suggestion = data.knowledgeSuggestions.find((item) => item.id === suggestionId);
  if (!suggestion) {
    return;
  }

  const page = data.knowledgePages.find((item) => item.id === suggestion.pageId);
  if (!page) {
    return;
  }

  page.content = [page.content, suggestion.content].filter((content) => content.trim()).join("<p><br></p>");
  page.updatedAt = now();
  page.updatedBy = user?.name;
  data.knowledgeSuggestions = data.knowledgeSuggestions.filter((item) => item.id !== suggestionId);
  saveData(data);
}

export function createProfile(name: string, email: string, role: UserRole = "technician") {
  const data = loadData();
  const profile: Profile = {
    id: id("profile"),
    name,
    email: email.trim().toLowerCase(),
    avatarUrl: "",
    phone: "",
    role,
    createdAt: now()
  };
  data.profiles.push(profile);
  savePassword(profile.email, "technik123");
  saveData(data);
  return profile;
}

export function updateLandingContent(patch: LandingContent) {
  const data = loadData();
  data.landingContent = patch;
  saveData(data);
}

export function updateProfileRole(profileId: string, role: UserRole) {
  const data = loadData();
  const profile = data.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }

  profile.role = role;
  saveData(data);

  const session = getSession();
  if (session?.id === profileId) {
    saveSession({ ...session, role });
  }
}

export function deleteProfile(profileId: string) {
  const data = loadData();
  const profile = data.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }

  data.profiles = data.profiles.filter((item) => item.id !== profileId);
  data.availability = data.availability.filter((item) => item.profileId !== profileId);
  data.assignments = data.assignments.filter((item) => item.profileId !== profileId);
  data.attendance = data.attendance.filter((item) => item.profileId !== profileId);
  deletePassword(profile.email);
  saveData(data);

  const session = getSession();
  if (session?.id === profileId) {
    saveSession(null);
  }
}
