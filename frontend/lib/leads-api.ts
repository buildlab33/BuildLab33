// frontend/lib/leads-api.ts
import api from "./api";

export type LeadPlatform = "instagram" | "youtube" | "linkedin" | "blog" | "podcast" | "twitter";

export interface LeadSuggestion {
  name: string;
  platform: LeadPlatform;
  handle: string;
  company: string;
  niche: string;
  audience_size: string;
  fit_score: number;
  reason: string;
  outreach_opener: string;
}

export interface DiscoverResponse {
  leads: LeadSuggestion[];
}

export const discoverLeads = (brand_id: string) =>
  api.post<DiscoverResponse>("/api/leads/discover", { brand_id });
