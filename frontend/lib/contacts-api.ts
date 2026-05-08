// frontend/lib/contacts-api.ts
import api from "./api";

export type ContactStatus = "lead" | "contacted" | "replied" | "meeting" | "won" | "lost" | "client";
export type ActivityChannel = "linkedin" | "email" | "call" | "meeting" | "other";

export interface ActivityItem {
  id: string;
  contact_id: string;
  created_by: string;
  channel: ActivityChannel;
  notes: string;
  activity_date: string;
  created_at: string;
}

export interface ContactItem {
  id: string;
  brand_id: string | null;
  created_by: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  status: ContactStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  activities: ActivityItem[];
}

export const getContacts = (params?: { brand_id?: string; status?: string; include_activities?: boolean }) =>
  api.get<ContactItem[]>("/api/contacts", { params });

export const getContact = (id: string) =>
  api.get<ContactItem>(`/api/contacts/${id}`);

export const createContact = (data: Partial<ContactItem>) =>
  api.post<ContactItem>("/api/contacts", data);

export const updateContact = (id: string, data: Partial<ContactItem>) =>
  api.patch<ContactItem>(`/api/contacts/${id}`, data);

export const deleteContact = (id: string) =>
  api.delete(`/api/contacts/${id}`);

export const logActivity = (
  contact_id: string,
  data: { channel: ActivityChannel; notes: string; activity_date: string }
) => api.post<ActivityItem>(`/api/contacts/${contact_id}/activities`, data);

export const deleteActivity = (contact_id: string, activity_id: string) =>
  api.delete(`/api/contacts/${contact_id}/activities/${activity_id}`);
