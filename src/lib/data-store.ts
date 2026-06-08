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

function normalizeLandingContent(value?: Partial<LandingContent>): LandingContent {
  const defaults = cloneData(demoData).landingContent;
  const landing = { ...defaults, ...(value ?? {}) };
  landing.eventImages = landing.eventImages?.length ? landing.eventImages : defaults.eventImages;
  landing.teamImage = landing.teamImage ?? defaults.teamImage;
  landing.teamNames = landing.teamNames?.length ? landing.teamNames : defaults.teamNames;
  landing.teamNames = landing.teamNames.map((name) => (name === "Teamleitung" ? "Max" : name));
  landing.impressions = landing.impressions?.length ? landing.impressions : defaults.impressions;
  landing.stats = landing.stats?.length ? landing.stats : defaults.stats;

  if (landing.joinText.includes("Keine Vorerfahrung nötig") && !landing.joinText.includes("Freitag um 13:00 Uhr")) {
    landing.joinText =
      "Wir suchen Schüler, die Lust auf Technik, Verantwortung und echte Veranstaltungen haben. Keine Vorerfahrung nötig, nur Neugier und Zuverlässigkeit. Hast du Interesse? Dann komm doch gerne am Freitag um 13:00 Uhr in die Aula!";
  }

  return landing;
}

function landingSettings(value: unknown): Partial<LandingContent> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Partial<LandingContent>;
}

function landingContentSettings(content: LandingContent) {
  return {
    brandTitle: content.brandTitle,
    heroKicker: content.heroKicker,
    primaryButtonText: content.primaryButtonText,
    requestButtonText: content.requestButtonText,
    stats: content.stats,
    impressionsKicker: content.impressionsKicker,
    impressionsTitle: content.impressionsTitle,
    teamKicker: content.teamKicker,
    teamTitle: content.teamTitle,
    requestKicker: content.requestKicker,
    requestTitle: content.requestTitle,
    requestText: content.requestText,
    requestCta: content.requestCta
  };
}

function normalizeData(data: AppData): AppData {
  const normalized = data as AppData;
  normalized.registrationRequests = normalized.registrationRequests ?? [];
  normalized.landingContent = normalizeLandingContent(normalized.landingContent);
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

function attachmentFiles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const file = item as { name?: unknown; type?: unknown; url?: unknown };
      return typeof file.name === "string" && typeof file.url === "string"
        ? { name: file.name, type: typeof file.type === "string" ? file.type : "", url: file.url }
        : null;
    })
    .filter(Boolean) as Array<{ name: string; type: string; url: string }>;
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

export async function loadRemoteData(): Promise<AppData> {
  const fallback = loadData();
  if (!hasSupabaseConfig || !supabase) {
    return fallback;
  }

  const [
    profilesResult,
    requestsResult,
    eventsResult,
    availabilityResult,
    assignmentsResult,
    attendanceResult,
    registrationsResult,
    knowledgePagesResult,
    knowledgeSuggestionsResult,
    landingResult
  ] = await Promise.all([
    supabase.from("profiles").select("id, name, email, avatar_url, phone, role, created_at").order("created_at", { ascending: true }),
    supabase.from("event_requests").select("id, title, starts_at, ends_at, location, contact_name, contact_email, event_type, tech_needs, notes, presentation_files, status, created_at").order("created_at", { ascending: false }),
    supabase.from("events").select("id, title, starts_at, ends_at, location, event_type, status, contact_name, contact_email, microphone_count, tech_needs, notes, presentation_files, request_id, created_at").order("starts_at", { ascending: true }),
    supabase.from("event_availability").select("id, event_id, profile_id, status, updated_at"),
    supabase.from("event_assignments").select("id, event_id, profile_id, role, created_at"),
    supabase.from("event_attendance").select("id, event_id, profile_id, role, attended, created_at"),
    supabase.from("registration_requests").select("id, name, email, phone, motivation, password, status, created_at").order("created_at", { ascending: false }),
    supabase.from("knowledge_pages").select("id, title, content, updated_at, updated_by"),
    supabase.from("knowledge_suggestions").select("id, page_id, content, author_id, author_name, created_at").order("created_at", { ascending: false }),
    supabase
      .from("landing_content")
      .select("hero_title, hero_text, join_title, join_text, event_images, team_image, team_names, impressions, content_settings")
      .maybeSingle()
  ]);

  const remote: AppData = normalizeData({
    ...fallback,
    profiles: profilesResult.data?.map((profile) => ({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatar_url ?? "",
      phone: profile.phone ?? "",
      role: profile.role,
      createdAt: profile.created_at
    })) ?? fallback.profiles,
    requests: requestsResult.data?.map((request) => ({
      id: request.id,
      title: request.title,
      startsAt: request.starts_at,
      endsAt: request.ends_at,
      location: request.location,
      contactName: request.contact_name,
      contactEmail: request.contact_email,
      eventType: request.event_type,
      techNeeds: request.tech_needs,
      notes: request.notes,
      presentationFiles: attachmentFiles(request.presentation_files),
      status: request.status,
      createdAt: request.created_at
    })) ?? fallback.requests,
    events: eventsResult.data?.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: event.location,
      eventType: event.event_type,
      status: event.status,
      contactName: event.contact_name ?? "",
      contactEmail: event.contact_email ?? "",
      microphoneCount: event.microphone_count ?? undefined,
      techNeeds: event.tech_needs,
      notes: event.notes,
      presentationFiles: attachmentFiles(event.presentation_files),
      requestId: event.request_id ?? undefined,
      createdAt: event.created_at
    })) ?? fallback.events,
    availability: availabilityResult.data?.map((availability) => ({
      id: availability.id,
      eventId: availability.event_id,
      profileId: availability.profile_id,
      status: availability.status,
      updatedAt: availability.updated_at
    })) ?? fallback.availability,
    assignments: assignmentsResult.data?.map((assignment) => ({
      id: assignment.id,
      eventId: assignment.event_id,
      profileId: assignment.profile_id,
      role: assignment.role,
      createdAt: assignment.created_at
    })) ?? fallback.assignments,
    attendance: attendanceResult.data?.map((attendance) => ({
      id: attendance.id,
      eventId: attendance.event_id,
      profileId: attendance.profile_id,
      role: attendance.role,
      attended: attendance.attended,
      createdAt: attendance.created_at
    })) ?? fallback.attendance,
    registrationRequests: registrationsResult.data?.map((request) => ({
      id: request.id,
      name: request.name,
      email: request.email,
      phone: request.phone ?? "",
      motivation: request.motivation,
      password: request.password,
      status: request.status,
      createdAt: request.created_at
    })) ?? fallback.registrationRequests,
    knowledgePages: knowledgePagesResult.data?.map((page) => ({
      id: page.id,
      title: page.title,
      content: page.content,
      updatedAt: page.updated_at,
      updatedBy: page.updated_by ?? undefined
    })) ?? fallback.knowledgePages,
    knowledgeSuggestions: knowledgeSuggestionsResult.data?.map((suggestion) => ({
      id: suggestion.id,
      pageId: suggestion.page_id,
      content: suggestion.content,
      authorId: suggestion.author_id,
      authorName: suggestion.author_name,
      createdAt: suggestion.created_at
    })) ?? fallback.knowledgeSuggestions,
    landingContent: landingResult.data
      ? normalizeLandingContent({
          ...landingSettings(landingResult.data.content_settings),
          heroTitle: landingResult.data.hero_title,
          heroText: landingResult.data.hero_text,
          joinTitle: landingResult.data.join_title,
          joinText: landingResult.data.join_text,
          eventImages: Array.isArray(landingResult.data.event_images) ? landingResult.data.event_images : fallback.landingContent.eventImages,
          teamImage: landingResult.data.team_image,
          teamNames: Array.isArray(landingResult.data.team_names) ? landingResult.data.team_names : fallback.landingContent.teamNames,
          impressions: Array.isArray(landingResult.data.impressions) ? landingResult.data.impressions : fallback.landingContent.impressions
        })
      : fallback.landingContent
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(remote));
  }

  return remote;
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

async function authHeaders() {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Nicht angemeldet.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
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

export async function createPublicRequest(input: EventRequestInput) {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase
      .from("event_requests")
      .insert({
        title: input.title,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        location: input.location,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        event_type: input.eventType,
        tech_needs: input.techNeeds ?? "",
        notes: input.notes,
        presentation_files: input.presentationFiles ?? [],
        status: "pending"
      })
      .select(
        "id, title, starts_at, ends_at, location, contact_name, contact_email, event_type, tech_needs, notes, presentation_files, status, created_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Anfrage konnte nicht gespeichert werden.");
    }

    return {
      id: data.id,
      title: data.title,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      location: data.location,
      contactName: data.contact_name,
      contactEmail: data.contact_email,
      eventType: data.event_type,
      techNeeds: data.tech_needs,
      notes: data.notes,
      presentationFiles: attachmentFiles(data.presentation_files),
      status: data.status,
      createdAt: data.created_at
    } satisfies EventRequest;
  }

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

export async function createRegistrationRequest(input: RegistrationRequestInput) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("registration_requests").insert({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() ?? "",
      motivation: input.motivation.trim(),
      password: input.password,
      status: "pending"
    });
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function approveRegistrationRequest(requestId: string) {
  if (hasSupabaseConfig && supabase) {
    const response = await fetch(`/api/admin/registration-requests/${requestId}/approve`, {
      method: "POST",
      headers: await authHeaders()
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Anfrage konnte nicht angenommen werden."));
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function rejectRegistrationRequest(requestId: string) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("registration_requests").update({ status: "rejected" }).eq("id", requestId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  const request = data.registrationRequests.find((item) => item.id === requestId);
  if (request) {
    request.status = "rejected";
    saveData(data);
  }
}

export async function deleteRegistrationRequest(requestId: string) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("registration_requests").delete().eq("id", requestId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  data.registrationRequests = data.registrationRequests.filter((item) => item.id !== requestId);
  saveData(data);
}

export async function approveRequest(requestId: string) {
  const data = loadData();
  const request = data.requests.find((item) => item.id === requestId);
  if (!request) {
    return;
  }

  if (hasSupabaseConfig && supabase) {
    const { error: requestError } = await supabase.from("event_requests").update({ status: "approved" }).eq("id", requestId);
    const { error: eventError } = await supabase.from("events").insert({
      title: request.title,
      starts_at: request.startsAt,
      ends_at: request.endsAt,
      location: request.location,
      event_type: request.eventType,
      status: "Nicht begonnen",
      contact_name: request.contactName,
      contact_email: request.contactEmail,
      tech_needs: request.techNeeds,
      presentation_files: request.presentationFiles ?? [],
      notes: `${request.notes}\nKontakt: ${request.contactName} (${request.contactEmail})`.trim(),
      request_id: request.id
    });
    if (requestError || eventError) {
      throw new Error(requestError?.message ?? eventError?.message ?? "Anfrage konnte nicht angenommen werden.");
    }
    window.dispatchEvent(new Event("ak-motion-data"));
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
    presentationFiles: request.presentationFiles ?? [],
    requestId: request.id,
    createdAt: now()
  };
  data.events.unshift(event);
  saveData(data);
}

export async function rejectRequest(requestId: string) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("event_requests").update({ status: "rejected" }).eq("id", requestId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  const request = data.requests.find((item) => item.id === requestId);
  if (request) {
    request.status = "rejected";
    saveData(data);
  }
}

export async function deleteRequest(requestId: string) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("event_requests").delete().eq("id", requestId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  data.requests = data.requests.filter((item) => item.id !== requestId);
  saveData(data);
}

export async function createEvent(input: Omit<CalendarEvent, "id" | "createdAt">) {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: input.title,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        location: input.location,
        event_type: input.eventType,
        status: input.status ?? "Nicht begonnen",
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        microphone_count: input.microphoneCount,
        tech_needs: input.techNeeds,
        notes: input.notes,
        presentation_files: input.presentationFiles ?? [],
        request_id: input.requestId
      })
      .select("id, title, starts_at, ends_at, location, event_type, status, contact_name, contact_email, microphone_count, tech_needs, notes, presentation_files, request_id, created_at")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Veranstaltung konnte nicht erstellt werden.");
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return {
      id: data.id,
      title: data.title,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      location: data.location,
      eventType: data.event_type,
      status: data.status,
      contactName: data.contact_name ?? "",
      contactEmail: data.contact_email ?? "",
      microphoneCount: data.microphone_count ?? undefined,
      techNeeds: data.tech_needs,
      notes: data.notes,
      presentationFiles: attachmentFiles(data.presentation_files),
      requestId: data.request_id ?? undefined,
      createdAt: data.created_at
    } satisfies CalendarEvent;
  }

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

export async function deleteEvent(eventId: string) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  data.events = data.events.filter((item) => item.id !== eventId);
  data.availability = data.availability.filter((item) => item.eventId !== eventId);
  data.assignments = data.assignments.filter((item) => item.eventId !== eventId);
  data.attendance = data.attendance.filter((item) => item.eventId !== eventId);
  saveData(data);
}

export async function setAvailability(eventId: string, profileId: string, status: AvailabilityStatus) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase
      .from("event_availability")
      .upsert(
        {
          event_id: eventId,
          profile_id: profileId,
          status,
          updated_at: now()
        },
        { onConflict: "event_id,profile_id" }
      );
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function addAssignment(eventId: string, profileId: string, role: AssignmentRole) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase
      .from("event_assignments")
      .upsert(
        {
          event_id: eventId,
          profile_id: profileId,
          role
        },
        { onConflict: "event_id,profile_id,role" }
      );
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function removeAssignment(eventId: string, profileId: string, role: AssignmentRole) {
  if (hasSupabaseConfig && supabase) {
    const { error: assignmentError } = await supabase
      .from("event_assignments")
      .delete()
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .eq("role", role);
    const { error: attendanceError } = await supabase
      .from("event_attendance")
      .delete()
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .eq("role", role);
    if (assignmentError || attendanceError) {
      throw new Error(assignmentError?.message ?? attendanceError?.message ?? "Einteilung konnte nicht entfernt werden.");
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  data.assignments = data.assignments.filter(
    (item) => !(item.eventId === eventId && item.profileId === profileId && item.role === role)
  );
  data.attendance = data.attendance.filter(
    (item) => !(item.eventId === eventId && item.profileId === profileId && item.role === role)
  );
  saveData(data);
}

export async function markAttendance(eventId: string, profileId: string, role: AssignmentRole) {
  if (hasSupabaseConfig && supabase) {
    const { data: existing, error: selectError } = await supabase
      .from("event_attendance")
      .select("id, attended")
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .eq("role", role)
      .maybeSingle();
    if (selectError) {
      throw new Error(selectError.message);
    }

    const nextAttended = !(existing?.attended ?? false);
    const { error } = existing
      ? await supabase.from("event_attendance").update({ attended: nextAttended }).eq("id", existing.id)
      : await supabase.from("event_attendance").insert({
          event_id: eventId,
          profile_id: profileId,
          role,
          attended: true
        });
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function updateEventNotes(eventId: string, notes: string) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("events").update({ notes }).eq("id", eventId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  const event = data.events.find((item) => item.id === eventId);
  if (event) {
    event.notes = notes;
    saveData(data);
  }
}

export async function updateEvent(eventId: string, patch: Partial<CalendarEvent>) {
  if (hasSupabaseConfig && supabase) {
    const remotePatch: Record<string, unknown> = {};
    if (patch.title !== undefined) remotePatch.title = patch.title;
    if (patch.startsAt !== undefined) remotePatch.starts_at = patch.startsAt;
    if (patch.endsAt !== undefined) remotePatch.ends_at = patch.endsAt;
    if (patch.location !== undefined) remotePatch.location = patch.location;
    if (patch.eventType !== undefined) remotePatch.event_type = patch.eventType;
    if (patch.status !== undefined) remotePatch.status = patch.status;
    if (patch.contactName !== undefined) remotePatch.contact_name = patch.contactName;
    if (patch.contactEmail !== undefined) remotePatch.contact_email = patch.contactEmail;
    if (patch.microphoneCount !== undefined) remotePatch.microphone_count = patch.microphoneCount;
    if (patch.techNeeds !== undefined) remotePatch.tech_needs = patch.techNeeds;
    if (patch.notes !== undefined) remotePatch.notes = patch.notes;
    if (patch.presentationFiles !== undefined) remotePatch.presentation_files = patch.presentationFiles;
    if (patch.requestId !== undefined) remotePatch.request_id = patch.requestId;
    const { error } = await supabase.from("events").update(remotePatch).eq("id", eventId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  const event = data.events.find((item) => item.id === eventId);
  if (event) {
    Object.assign(event, patch);
    saveData(data);
  }
}

export async function updateProfile(profileId: string, patch: Partial<Pick<Profile, "avatarUrl" | "name" | "phone">>) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase
      .from("profiles")
      .update({
        ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {})
      })
      .eq("id", profileId);
    if (error) {
      throw new Error(error.message);
    }
  }

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

export async function updateKnowledgePage(pageId: KnowledgePageId, content: string, user?: SessionUser | null) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("knowledge_pages").upsert({
      id: pageId,
      title: knowledgePages.find((page) => page.id === pageId)?.title ?? pageId,
      content,
      updated_at: now(),
      updated_by: user?.name ?? null
    });
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function createKnowledgeSuggestion(pageId: KnowledgePageId, content: string, user: SessionUser) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("knowledge_suggestions").insert({
      page_id: pageId,
      content,
      author_id: user.id,
      author_name: user.name
    });
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function deleteKnowledgeSuggestion(suggestionId: string) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("knowledge_suggestions").delete().eq("id", suggestionId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  data.knowledgeSuggestions = data.knowledgeSuggestions.filter((item) => item.id !== suggestionId);
  saveData(data);
}

export async function acceptKnowledgeSuggestion(suggestionId: string, user?: SessionUser | null) {
  if (hasSupabaseConfig && supabase) {
    const { data: suggestion, error: suggestionError } = await supabase
      .from("knowledge_suggestions")
      .select("page_id, content")
      .eq("id", suggestionId)
      .maybeSingle();
    if (suggestionError) {
      throw new Error(suggestionError.message);
    }
    if (!suggestion) {
      return;
    }

    const { data: page, error: pageError } = await supabase
      .from("knowledge_pages")
      .select("title, content")
      .eq("id", suggestion.page_id)
      .maybeSingle();
    if (pageError) {
      throw new Error(pageError.message);
    }

    const definition = knowledgePages.find((item) => item.id === suggestion.page_id);
    const nextContent = [page?.content ?? "", suggestion.content].filter((item) => item.trim()).join("<p><br></p>");
    const { error: upsertError } = await supabase.from("knowledge_pages").upsert({
      id: suggestion.page_id,
      title: page?.title ?? definition?.title ?? suggestion.page_id,
      content: nextContent,
      updated_at: now(),
      updated_by: user?.name ?? null
    });
    const { error: deleteError } = await supabase.from("knowledge_suggestions").delete().eq("id", suggestionId);
    if (upsertError || deleteError) {
      throw new Error(upsertError?.message ?? deleteError?.message ?? "Vorschlag konnte nicht übernommen werden.");
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function createProfile(name: string, email: string, role: UserRole = "technician") {
  if (hasSupabaseConfig && supabase) {
    const response = await fetch("/api/admin/profiles", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ name, email, role })
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Profil konnte nicht erstellt werden."));
    }
    const body = (await response.json()) as { profile: Profile };
    window.dispatchEvent(new Event("ak-motion-data"));
    return body.profile;
  }

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

export async function updateLandingContent(patch: LandingContent) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("landing_content").upsert({
      id: true,
      hero_title: patch.heroTitle,
      hero_text: patch.heroText,
      join_title: patch.joinTitle,
      join_text: patch.joinText,
      event_images: patch.eventImages,
      team_image: patch.teamImage,
      team_names: patch.teamNames,
      impressions: patch.impressions,
      content_settings: landingContentSettings(patch),
      updated_at: now()
    });
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

  const data = loadData();
  data.landingContent = normalizeLandingContent(patch);
  saveData(data);
}

export async function updateProfileRole(profileId: string, role: UserRole) {
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    if (error) {
      throw new Error(error.message);
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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

export async function deleteProfile(profileId: string) {
  if (hasSupabaseConfig && supabase) {
    const response = await fetch(`/api/admin/profiles/${profileId}`, {
      method: "DELETE",
      headers: await authHeaders()
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Profil konnte nicht gelöscht werden."));
    }
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }

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
