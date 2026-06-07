export type UserRole = "admin" | "technician";

export type AvailabilityStatus = "committed" | "backup";

export type AssignmentRole = "Ton" | "Licht" | "Umbau" | "Kleine";

export type RequestStatus = "pending" | "approved" | "rejected";
export type RegistrationStatus = "pending" | "approved" | "rejected";

export type KnowledgePageId = "rules" | "guides" | "tech-bible" | "ideas";

export type Profile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
};

export type EventRequest = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  contactName: string;
  contactEmail: string;
  eventType: string;
  techNeeds: string;
  notes: string;
  status: RequestStatus;
  createdAt: string;
};

export type Event = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  eventType: string;
  status?: string;
  contactName?: string;
  contactEmail?: string;
  microphoneCount?: number;
  techNeeds: string;
  notes: string;
  requestId?: string;
  createdAt: string;
};

export type EventAvailability = {
  id: string;
  eventId: string;
  profileId: string;
  status: AvailabilityStatus;
  updatedAt: string;
};

export type EventAssignment = {
  id: string;
  eventId: string;
  profileId: string;
  role: AssignmentRole;
  createdAt: string;
};

export type EventAttendance = {
  id: string;
  eventId: string;
  profileId: string;
  role: AssignmentRole;
  attended: boolean;
  createdAt: string;
};

export type KnowledgePage = {
  id: KnowledgePageId;
  title: string;
  content: string;
  updatedAt: string;
  updatedBy?: string;
};

export type KnowledgeSuggestion = {
  id: string;
  pageId: KnowledgePageId;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type RegistrationRequest = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  motivation: string;
  password: string;
  status: RegistrationStatus;
  createdAt: string;
};

export type LandingContent = {
  heroTitle: string;
  heroText: string;
  joinTitle: string;
  joinText: string;
  eventImages: string[];
  teamImage: string;
  teamNames: string[];
  impressions: LandingImpression[];
};

export type LandingImpression = {
  id: string;
  title: string;
  text: string;
  images: string[];
};

export type AppData = {
  profiles: Profile[];
  registrationRequests: RegistrationRequest[];
  landingContent: LandingContent;
  requests: EventRequest[];
  events: Event[];
  availability: EventAvailability[];
  assignments: EventAssignment[];
  attendance: EventAttendance[];
  knowledgePages: KnowledgePage[];
  knowledgeSuggestions: KnowledgeSuggestion[];
};

export type RegistrationRequestInput = Pick<RegistrationRequest, "email" | "motivation" | "name" | "password" | "phone">;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
  role: UserRole;
};

export type EventRequestInput = Pick<
  EventRequest,
  | "title"
  | "startsAt"
  | "endsAt"
  | "location"
  | "contactName"
  | "contactEmail"
  | "eventType"
  | "techNeeds"
  | "notes"
>;
