export type UserRole = "admin" | "technician";

export type AvailabilityStatus = "committed" | "backup";

export type AssignmentRole = "Ton" | "Licht" | "Umbau";

export type RequestStatus = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  name: string;
  email: string;
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

export type AppData = {
  profiles: Profile[];
  requests: EventRequest[];
  events: Event[];
  availability: EventAvailability[];
  assignments: EventAssignment[];
  attendance: EventAttendance[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
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
