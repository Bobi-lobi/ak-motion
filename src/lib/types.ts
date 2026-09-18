export type UserRole = "admin" | "technician";

export type AvailabilityStatus = "committed" | "backup";

export type AssignmentRole = "Ton" | "Licht" | "Angel" | "Umbau" | "Kleine" | "Teilnehmer";

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
  presentationFiles?: AttachmentFile[];
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
  presentationFiles?: AttachmentFile[];
  requestId?: string;
  relatedEventId?: string;
  createdAt: string;
};

export type AttachmentFile = {
  name: string;
  type: string;
  url: string;
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
  authUserId?: string;
  name: string;
  email: string;
  phone?: string;
  motivation: string;
  password?: string;
  status: RegistrationStatus;
  createdAt: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  createdBy?: string;
  createdAt: string;
  expiresAt?: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  attachments: AttachmentFile[];
  poll?: ChatPoll;
  reactions: ChatReaction[];
  replyTo?: ChatMessagePreview;
  editedAt?: string;
  pinnedAt?: string;
  pinnedBy?: string;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  kind: "group" | "direct";
  memberIds: string[];
  createdBy?: string;
  createdAt: string;
  lastMessage?: ChatMessagePreview;
  unreadCount: number;
};

export type ChatMessagePreview = {
  id: string;
  authorId: string;
  body: string;
  attachmentCount: number;
};

export type ChatReaction = {
  emoji: string;
  profileIds: string[];
};

export type ChatPoll = {
  allowMultiple: boolean;
  options: ChatPollOption[];
  question: string;
};

export type ChatPollOption = {
  id: string;
  label: string;
  voterIds: string[];
};

export type ChatReadReceipt = {
  conversationId: string;
  profileId: string;
  messageId: string;
  readAt: string;
};

export type XpAward = {
  id: string;
  profileId: string;
  amount: number;
  reason: string;
  createdBy?: string;
  createdAt: string;
};

export type EventPreparationRating = {
  id: string;
  eventId: string;
  ratedBy: string;
  stars: number;
  createdAt: string;
  updatedAt: string;
};

export type LandingContent = {
  brandTitle: string;
  heroKicker: string;
  heroTitle: string;
  heroText: string;
  primaryButtonText: string;
  requestButtonText: string;
  stats: LandingStat[];
  impressionsKicker: string;
  impressionsTitle: string;
  teamKicker: string;
  teamTitle: string;
  requestKicker: string;
  requestTitle: string;
  requestText: string;
  requestCta: string;
  joinTitle: string;
  joinText: string;
  eventImages: string[];
  teamImage: string;
  teamNames: string[];
  impressions: LandingImpression[];
};

export type LandingStat = {
  id: "events" | "lamps" | "technicians" | "equipment";
  label: string;
  suffix: string;
  manualValue?: number;
};

export type LandingImpression = {
  id: string;
  title: string;
  text: string;
  images: string[];
};

export type AppData = {
  announcements: Announcement[];
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
  xpAwards: XpAward[];
  preparationRatings: EventPreparationRating[];
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
  | "presentationFiles"
>;
