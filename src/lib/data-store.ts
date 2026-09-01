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
const PENDING_KNOWLEDGE_KEY = "ak-motion-pending-knowledge";
const PENDING_EVENTS_KEY = "ak-motion-pending-events";

type PendingKnowledgeWrite = { content: string; pageId: KnowledgePageId; title: string; updatedAt: string; updatedBy?: string };
type PendingEventWrite = { eventId: string; patch: Partial<CalendarEvent>; updatedAt: string };

function loadPendingKnowledgeWrites(): Record<string, PendingKnowledgeWrite> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KNOWLEDGE_KEY) ?? "{}") as Record<string, PendingKnowledgeWrite>;
  } catch {
    return {};
  }
}

function savePendingKnowledgeWrites(writes: Record<string, PendingKnowledgeWrite>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PENDING_KNOWLEDGE_KEY, JSON.stringify(writes));
  } catch (error) {
    console.warn("Die ausstehende Dokumentänderung konnte nicht lokal zwischengespeichert werden.", error);
  }
}

function loadPendingEventWrites(): Record<string, PendingEventWrite> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_EVENTS_KEY) ?? "{}") as Record<string, PendingEventWrite>;
  } catch {
    return {};
  }
}

function savePendingEventWrites(writes: Record<string, PendingEventWrite>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(writes));
  } catch (error) {
    console.warn("Die ausstehende Veranstaltungsänderung konnte nicht lokal zwischengespeichert werden.", error);
  }
}

function rememberPendingKnowledgeWrite(write: PendingKnowledgeWrite) {
  const writes = loadPendingKnowledgeWrites();
  writes[write.pageId] = write;
  savePendingKnowledgeWrites(writes);
}

function forgetPendingKnowledgeWrite(pageId: KnowledgePageId) {
  const writes = loadPendingKnowledgeWrites();
  delete writes[pageId];
  savePendingKnowledgeWrites(writes);
}

function rememberPendingEventWrite(eventId: string, patch: Partial<CalendarEvent>) {
  const writes = loadPendingEventWrites();
  writes[eventId] = {
    eventId,
    patch: { ...(writes[eventId]?.patch ?? {}), ...patch },
    updatedAt: now()
  };
  savePendingEventWrites(writes);
}

function forgetPendingEventWrite(eventId: string) {
  const writes = loadPendingEventWrites();
  delete writes[eventId];
  savePendingEventWrites(writes);
}

function cloneData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function cacheData(data: AppData) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch (error) {
    // Safari keeps a comparatively small localStorage quota. The landing page
    // can exceed it because uploaded images are currently stored as data URLs.
    // Keep a lightweight cache; Supabase remains the source of truth.
    try {
      const lightweight = cloneData(data);
      lightweight.landingContent.eventImages = [];
      lightweight.landingContent.teamImage = "";
      lightweight.landingContent.impressions = lightweight.landingContent.impressions.map((impression) => ({
        ...impression,
        images: []
      }));
      window.localStorage.removeItem(DATA_KEY);
      window.localStorage.setItem(DATA_KEY, JSON.stringify(lightweight));
    } catch (fallbackError) {
      try {
        window.localStorage.removeItem(DATA_KEY);
      } catch {
        // Storage can be unavailable entirely in restrictive Safari contexts.
      }
      console.warn("Auch der reduzierte lokale Cache konnte nicht gespeichert werden.", fallbackError);
    }
    console.warn("Der lokale Bild-Cache war voll; die Bilder werden direkt aus Supabase geladen.", error);
  }
}

function withoutDemoRecords(data: AppData): AppData {
  const demoProfileIds = new Set(demoData.profiles.map((item) => item.id));
  const demoRequestIds = new Set(demoData.requests.map((item) => item.id));
  const demoEventIds = new Set(demoData.events.map((item) => item.id));
  const demoAvailabilityIds = new Set(demoData.availability.map((item) => item.id));
  const demoAssignmentIds = new Set(demoData.assignments.map((item) => item.id));
  const demoAttendanceIds = new Set(demoData.attendance.map((item) => item.id));

  const demoLanding = demoData.landingContent;
  const landingContent = { ...data.landingContent };
  if (sameValue(landingContent.eventImages, demoLanding.eventImages)) {
    landingContent.eventImages = [];
  }
  if (landingContent.teamImage === demoLanding.teamImage) {
    landingContent.teamImage = "";
  }
  if (sameValue(landingContent.teamNames, demoLanding.teamNames)) {
    landingContent.teamNames = [];
  }
  if (sameValue(landingContent.impressions, demoLanding.impressions)) {
    landingContent.impressions = [];
  }

  return {
    ...data,
    profiles: data.profiles.filter((item) => !demoProfileIds.has(item.id)),
    requests: data.requests.filter((item) => !demoRequestIds.has(item.id)),
    events: data.events.filter((item) => !demoEventIds.has(item.id)),
    availability: data.availability.filter((item) => !demoAvailabilityIds.has(item.id)),
    assignments: data.assignments.filter((item) => !demoAssignmentIds.has(item.id)),
    attendance: data.attendance.filter((item) => !demoAttendanceIds.has(item.id)),
    landingContent
  };
}

function initialData(): AppData {
  const seeded = normalizeData(cloneData(demoData));
  return hasSupabaseConfig ? withoutDemoRecords(seeded) : seeded;
}

function normalizeLandingContent(value?: Partial<LandingContent>): LandingContent {
  const defaults = cloneData(demoData).landingContent;
  const landing = { ...defaults, ...(value ?? {}) };
  landing.eventImages = Array.isArray(value?.eventImages) ? value.eventImages : defaults.eventImages;
  landing.teamImage = typeof value?.teamImage === "string" ? value.teamImage : defaults.teamImage;
  landing.teamNames = Array.isArray(value?.teamNames) ? value.teamNames : defaults.teamNames;
  landing.teamNames = landing.teamNames.map((name) => (name === "Teamleitung" ? "Max" : name));
  landing.impressions = Array.isArray(value?.impressions) ? value.impressions : defaults.impressions;
  landing.stats = Array.isArray(value?.stats) && value.stats.length ? value.stats : defaults.stats;

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
    const seeded = initialData();
    cacheData(seeded);
    return seeded;
  }

  try {
    const normalized = normalizeData(JSON.parse(existing) as AppData);
    const parsed = hasSupabaseConfig ? withoutDemoRecords(normalized) : normalized;
    cacheData(parsed);
    return parsed;
  } catch {
    const seeded = initialData();
    cacheData(seeded);
    return seeded;
  }
}

export function saveData(data: AppData) {
  cacheData(data);
  window.dispatchEvent(new Event("ak-motion-data"));
}

export async function loadRemoteData(): Promise<AppData> {
  const fallback = loadData();
  if (!hasSupabaseConfig || !supabase) {
    return fallback;
  }

  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) {
    throw authError;
  }
  const isAuthenticated = Boolean(authData.session);

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
    supabase.from("registration_requests").select("id, auth_user_id, name, email, phone, motivation, status, created_at").order("created_at", { ascending: false }),
    supabase.from("knowledge_pages").select("id, title, content, updated_at, updated_by"),
    supabase.from("knowledge_suggestions").select("id, page_id, content, author_id, author_name, created_at").order("created_at", { ascending: false }),
    supabase
      .from("landing_content")
      .select("hero_title, hero_text, join_title, join_text, event_images, team_image, team_names, impressions, content_settings")
      .maybeSingle()
  ]);

  const remote: AppData = normalizeData({
    ...fallback,
    profiles: isAuthenticated && profilesResult.data ? profilesResult.data.map((profile) => ({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatar_url ?? "",
      phone: profile.phone ?? "",
      role: profile.role,
      createdAt: profile.created_at
    })) : fallback.profiles,
    requests: isAuthenticated && requestsResult.data ? requestsResult.data.map((request) => ({
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
    })) : fallback.requests,
    events: isAuthenticated && eventsResult.data ? eventsResult.data.map((event) => ({
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
    })) : fallback.events,
    availability: isAuthenticated && availabilityResult.data ? availabilityResult.data.map((availability) => ({
      id: availability.id,
      eventId: availability.event_id,
      profileId: availability.profile_id,
      status: availability.status,
      updatedAt: availability.updated_at
    })) : fallback.availability,
    assignments: isAuthenticated && assignmentsResult.data ? assignmentsResult.data.map((assignment) => ({
      id: assignment.id,
      eventId: assignment.event_id,
      profileId: assignment.profile_id,
      role: assignment.role,
      createdAt: assignment.created_at
    })) : fallback.assignments,
    attendance: isAuthenticated && attendanceResult.data ? attendanceResult.data.map((attendance) => ({
      id: attendance.id,
      eventId: attendance.event_id,
      profileId: attendance.profile_id,
      role: attendance.role,
      attended: attendance.attended,
      createdAt: attendance.created_at
    })) : fallback.attendance,
    registrationRequests: isAuthenticated && registrationsResult.data ? registrationsResult.data.map((request) => ({
      id: request.id,
      authUserId: request.auth_user_id ?? undefined,
      name: request.name,
      email: request.email,
      phone: request.phone ?? "",
      motivation: request.motivation,
      status: request.status,
      createdAt: request.created_at
    })) : fallback.registrationRequests,
    knowledgePages: isAuthenticated && knowledgePagesResult.data ? knowledgePagesResult.data.map((page) => ({
      id: page.id,
      title: page.title,
      content: page.content,
      updatedAt: page.updated_at,
      updatedBy: page.updated_by ?? undefined
    })) : fallback.knowledgePages,
    knowledgeSuggestions: isAuthenticated && knowledgeSuggestionsResult.data ? knowledgeSuggestionsResult.data.map((suggestion) => ({
      id: suggestion.id,
      pageId: suggestion.page_id,
      content: suggestion.content,
      authorId: suggestion.author_id,
      authorName: suggestion.author_name,
      createdAt: suggestion.created_at
    })) : fallback.knowledgeSuggestions,
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

  const pendingKnowledge = loadPendingKnowledgeWrites();
  Object.values(pendingKnowledge).forEach((write) => {
    const page = remote.knowledgePages.find((item) => item.id === write.pageId);
    if (page) {
      page.content = write.content;
      page.updatedAt = write.updatedAt;
      page.updatedBy = write.updatedBy;
    } else {
      remote.knowledgePages.push({
        id: write.pageId,
        title: write.title,
        content: write.content,
        updatedAt: write.updatedAt,
        updatedBy: write.updatedBy
      });
    }
  });

  const pendingEvents = loadPendingEventWrites();
  Object.values(pendingEvents).forEach((write) => {
    const event = remote.events.find((item) => item.id === write.eventId);
    if (event) {
      Object.assign(event, write.patch);
    }
  });

  const optimisticEvents = fallback.events.filter((event) => event.id.startsWith("optimistic-event-"));
  optimisticEvents.forEach((event) => {
    const remoteHasCreatedEvent = remote.events.some(
      (remoteEvent) =>
        remoteEvent.title === event.title &&
        remoteEvent.startsAt === event.startsAt &&
        remoteEvent.endsAt === event.endsAt &&
        remoteEvent.location === event.location
    );
    if (!remoteHasCreatedEvent && !remote.events.some((remoteEvent) => remoteEvent.id === event.id)) {
      remote.events.unshift(event);
    }
  });

  const optimisticAssignments = fallback.assignments.filter((assignment) =>
    assignment.id.startsWith("optimistic-assignment-")
  );
  optimisticAssignments.forEach((assignment) => {
    const remoteHasAssignment = remote.assignments.some(
      (remoteAssignment) =>
        remoteAssignment.eventId === assignment.eventId &&
        remoteAssignment.profileId === assignment.profileId &&
        remoteAssignment.role === assignment.role
    );
    if (!remoteHasAssignment) {
      remote.assignments.push(assignment);
    }
  });

  if (typeof window !== "undefined") {
    cacheData(remote);
    if (Object.keys(pendingKnowledge).length || Object.keys(pendingEvents).length) {
      void flushPendingRemoteWrites();
    }
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

function eventPatchToRemotePatch(patch: Partial<CalendarEvent>) {
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
  return remotePatch;
}

const editorBlockSelector =
  ":scope > p, :scope > div:not(.notion-page-link), :scope > h1, :scope > h2, :scope > h3, :scope > details, :scope > ul, :scope > ol, :scope > table, :scope > figure, :scope > .notion-page-link, li";

function editorMergeBlocks(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(editorBlockSelector)).filter(
    (block) => !block.closest(".notion-page-link") || block.classList.contains("notion-page-link")
  );
}

function mergeEditorHtml(remoteHtml: string, localHtml: string) {
  if (typeof document === "undefined") {
    return localHtml;
  }

  const trimmedLocal = localHtml.trim();
  if (!trimmedLocal) {
    return localHtml;
  }

  const remoteRoot = document.createElement("div");
  const localRoot = document.createElement("div");
  remoteRoot.innerHTML = remoteHtml.trim();
  localRoot.innerHTML = trimmedLocal;

  const localBlocks = editorMergeBlocks(localRoot).filter((block) => block.dataset.liveBlockId);
  const remoteBlocks = editorMergeBlocks(remoteRoot).filter((block) => block.dataset.liveBlockId);
  if (!localBlocks.length || !remoteBlocks.length) {
    return localHtml;
  }

  localBlocks.forEach((localBlock, index) => {
    const blockId = localBlock.dataset.liveBlockId;
    if (!blockId) {
      return;
    }

    const existingRemoteBlock = editorMergeBlocks(remoteRoot).find((block) => block.dataset.liveBlockId === blockId);
    const clonedLocalBlock = localBlock.cloneNode(true) as HTMLElement;
    if (existingRemoteBlock) {
      if (existingRemoteBlock.outerHTML !== clonedLocalBlock.outerHTML) {
        const mergedBlock = mergeEditorBlock(existingRemoteBlock, clonedLocalBlock);
        existingRemoteBlock.replaceWith(mergedBlock);
      }
      return;
    }

    const previousLocalId = localBlocks
      .slice(0, index)
      .reverse()
      .find((block) => block.dataset.liveBlockId)?.dataset.liveBlockId;
    const nextLocalId = localBlocks.slice(index + 1).find((block) => block.dataset.liveBlockId)?.dataset.liveBlockId;
    const previousRemote = previousLocalId
      ? editorMergeBlocks(remoteRoot).find((block) => block.dataset.liveBlockId === previousLocalId)
      : null;
    const nextRemote = nextLocalId
      ? editorMergeBlocks(remoteRoot).find((block) => block.dataset.liveBlockId === nextLocalId)
      : null;

    if (previousRemote) {
      previousRemote.after(clonedLocalBlock);
    } else if (nextRemote) {
      nextRemote.before(clonedLocalBlock);
    } else {
      remoteRoot.append(clonedLocalBlock);
    }
  });

  return remoteRoot.innerHTML;
}

function mergeEditorBlock(remoteBlock: HTMLElement, localBlock: HTMLElement) {
  if (remoteBlock.tagName !== localBlock.tagName || remoteBlock.querySelector("table, figure, img, video, audio")) {
    return localBlock;
  }

  const remoteText = remoteBlock.textContent ?? "";
  const localText = localBlock.textContent ?? "";
  if (!remoteText || !localText || remoteText === localText) {
    return localBlock;
  }

  const mergedText = mergeConcurrentPlainText(remoteText, localText);
  if (mergedText === localText) {
    return localBlock;
  }

  const mergedBlock = localBlock.cloneNode(true) as HTMLElement;
  replaceMergeBlockText(mergedBlock, mergedText);
  return mergedBlock;
}

function mergeConcurrentPlainText(remoteText: string, localText: string) {
  if (remoteText.includes(localText)) {
    return remoteText;
  }
  if (localText.includes(remoteText)) {
    return localText;
  }

  let prefixLength = 0;
  while (
    prefixLength < remoteText.length &&
    prefixLength < localText.length &&
    remoteText[prefixLength] === localText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < remoteText.length - prefixLength &&
    suffixLength < localText.length - prefixLength &&
    remoteText[remoteText.length - 1 - suffixLength] === localText[localText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const prefix = localText.slice(0, prefixLength);
  const suffix = suffixLength ? localText.slice(localText.length - suffixLength) : "";
  const remoteMiddle = remoteText.slice(prefixLength, suffixLength ? remoteText.length - suffixLength : remoteText.length);
  const localMiddle = localText.slice(prefixLength, suffixLength ? localText.length - suffixLength : localText.length);
  const middle = localMiddle.includes(remoteMiddle)
    ? localMiddle
    : remoteMiddle.includes(localMiddle)
      ? remoteMiddle
      : `${remoteMiddle}${localMiddle}`;

  return `${prefix}${middle}${suffix}`;
}

function replaceMergeBlockText(block: HTMLElement, text: string) {
  if (block.matches("ul, ol")) {
    const item = block.querySelector("li");
    if (item) {
      item.textContent = text;
    }
    return;
  }

  if (block.matches("details")) {
    const summary = block.querySelector("summary");
    if (summary) {
      summary.textContent = text;
    }
    return;
  }

  const paragraph = block.classList.contains("callout-block") ? block.querySelector("p") : null;
  if (paragraph) {
    paragraph.textContent = text;
    return;
  }

  block.textContent = text;
}

function updateLocalKnowledgePage(pageId: KnowledgePageId, title: string, content: string, updatedAt: string, updatedBy?: string) {
  const localData = loadData();
  const localPage = localData.knowledgePages.find((item) => item.id === pageId);
  if (localPage) {
    localPage.content = content;
    localPage.updatedAt = updatedAt;
    localPage.updatedBy = updatedBy;
  } else {
    localData.knowledgePages.push({ id: pageId, title, content, updatedAt, updatedBy });
  }
  saveData(localData);
}

function updateLocalEvent(eventId: string, patch: Partial<CalendarEvent>) {
  const data = loadData();
  const event = data.events.find((item) => item.id === eventId);
  if (event) {
    Object.assign(event, patch);
    saveData(data);
  }
}

async function flushPendingRemoteWrites() {
  if (!hasSupabaseConfig || !supabase) {
    return;
  }

  const knowledgeWrites = loadPendingKnowledgeWrites();
  await Promise.all(
    Object.values(knowledgeWrites).map(async (write) => {
      const { error } = await supabase!.from("knowledge_pages").upsert({
        id: write.pageId,
        title: write.title,
        content: write.content,
        updated_at: write.updatedAt,
        updated_by: write.updatedBy ?? null
      });
      if (!error) {
        forgetPendingKnowledgeWrite(write.pageId);
      }
    })
  );

  const eventWrites = loadPendingEventWrites();
  await Promise.all(
    Object.values(eventWrites).map(async (write) => {
      const { error } = await supabase!.from("events").update(eventPatchToRemotePatch(write.patch)).eq("id", write.eventId);
      if (!error) {
        forgetPendingEventWrite(write.eventId);
      }
    })
  );
}

export async function login(email: string, password: string): Promise<SessionUser> {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Login fehlgeschlagen.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email, avatar_url, phone, role")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      throw new Error("Kein Profil für diesen Account gefunden.");
    }

    const profileWithDetails = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatar_url ?? "",
      phone: profile.phone ?? "",
      role: profile.role
    } satisfies SessionUser;
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
    const response = await fetch("/api/registration-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: input.password,
        motivation: input.motivation
      })
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Account konnte nicht erstellt werden."));
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
    status: "pending",
    createdAt: now()
  };
  data.registrationRequests.unshift(request);
  if (input.password) {
    savePassword(email, input.password);
  }
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
    const [{ error: availabilityError }, { error: assignmentError }, { error: attendanceError }] = await Promise.all([
      supabase.from("event_availability").delete().eq("event_id", eventId),
      supabase.from("event_assignments").delete().eq("event_id", eventId),
      supabase.from("event_attendance").delete().eq("event_id", eventId)
    ]);
    if (availabilityError || assignmentError || attendanceError) {
      throw new Error(
        availabilityError?.message ??
          assignmentError?.message ??
          attendanceError?.message ??
          "Veranstaltungsdaten konnten nicht entfernt werden."
      );
    }

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
  if (hasSupabaseConfig) {
    rememberPendingEventWrite(eventId, { notes });
  }

  updateLocalEvent(eventId, { notes });

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("events").update({ notes }).eq("id", eventId);
    if (error) {
      throw new Error(error.message);
    }
    forgetPendingEventWrite(eventId);
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }
}

export async function updateEvent(eventId: string, patch: Partial<CalendarEvent>) {
  if (hasSupabaseConfig) {
    rememberPendingEventWrite(eventId, patch);
  }

  updateLocalEvent(eventId, patch);

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("events").update(eventPatchToRemotePatch(patch)).eq("id", eventId);
    if (error) {
      throw new Error(error.message);
    }
    forgetPendingEventWrite(eventId);
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
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
  const title = knowledgePages.find((page) => page.id === pageId)?.title ?? pageId;
  const updatedAt = now();
  const updatedBy = user?.name;
  if (hasSupabaseConfig) {
    rememberPendingKnowledgeWrite({ pageId, title, content, updatedAt, updatedBy });
  }

  updateLocalKnowledgePage(pageId, title, content, updatedAt, updatedBy);

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from("knowledge_pages").upsert({
      id: pageId,
      title,
      content,
      updated_at: updatedAt,
      updated_by: updatedBy ?? null
    });
    if (error) {
      throw new Error(error.message);
    }
    forgetPendingKnowledgeWrite(pageId);
    window.dispatchEvent(new Event("ak-motion-data"));
    return;
  }
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
