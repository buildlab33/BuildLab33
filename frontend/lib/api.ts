import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(err);
      }
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
          { refresh_token: refreshToken }
        );
        const { access_token, refresh_token } = res.data;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        refreshQueue.forEach((cb) => cb(access_token));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────

export const login = (username: string, password: string) =>
  api.post("/api/auth/login", { username, password });

export const login2FA = (temp_token: string, code: string) =>
  api.post("/api/auth/login/2fa", { temp_token, code });

export const getMe = () => api.get("/api/auth/me");

export const checkUsername = (username: string) =>
  api.get("/api/auth/check-username", { params: { username } });

export const forgotPassword = (email: string) =>
  api.post("/api/auth/forgot-password", { email });

export const resetPassword = (token: string, password: string) =>
  api.post("/api/auth/reset-password", { token, password });

export const acceptInvite = (
  token: string,
  username: string,
  password: string,
  name: string
) => api.post("/api/auth/accept-invite", { token, username, password, name });

export const setup2FA = () => api.post("/api/auth/2fa/setup");

export const enable2FA = (code: string) =>
  api.post("/api/auth/2fa/enable", { code });

export const disable2FA = (code: string) =>
  api.post("/api/auth/2fa/disable", { code });

// ── Brands ────────────────────────────────────────────────────────────────

export interface BrandPublic {
  id: string;
  name: string;
  industry: string;
  logo_url: string | null;
  brand_colour: string;
  default_timezone: string;
  status: "active" | "archived";
}

export interface BrandDetail extends BrandPublic {
  content_pillars: Array<{ name: string; description: string }>;
  hashtag_sets: Array<{ platform: string; tags: string[] }>;
  voice_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InterviewAnswer {
  question_index: number;
  question: string;
  answer: string;
}

export const getBrands = (includeArchived = false) =>
  api.get("/api/brands", { params: { include_archived: includeArchived } });

export const getBrand = (id: string) => api.get<BrandDetail>(`/api/brands/${id}`);

export const createBrand = (data: {
  name: string;
  industry: string;
  brand_colour: string;
  default_timezone: string;
  content_pillars: Array<{ name: string; description: string }>;
  hashtag_sets: Array<{ platform: string; tags: string[] }>;
  voice_config?: Record<string, unknown>;
}) => api.post("/api/brands", data);

export const updateBrand = (id: string, data: Partial<BrandDetail>) =>
  api.patch(`/api/brands/${id}`, data);

export const archiveBrand = (id: string) => api.post(`/api/brands/${id}/archive`);
export const restoreBrand = (id: string) => api.post(`/api/brands/${id}/restore`);

export const getInterviewQuestions = () => api.get("/api/brands/interview-questions");

export const generateVoiceConfig = (data: {
  brand_name: string;
  industry: string;
  interview_answers: InterviewAnswer[];
  sample_posts: string[];
}) => api.post("/api/brands/generate-voice-config", data);

// ── Generate ──────────────────────────────────────────────────────────────

export const generatePost = (payload: {
  brand_id: string;
  platform: string;
  campaign_goal: string;
  audience: string;
  content_format?: string;
  growth_angle?: string;
  news_hook?: string;
}) => api.post("/api/generate", payload);

// ── Settings ──────────────────────────────────────────────────────────────

export const updateMe = (data: { name?: string; email?: string; preferences?: Record<string, unknown> }) =>
  api.patch("/api/auth/me", data);

export const changePassword = (data: { current_password: string; new_password: string; confirm_password: string }) =>
  api.post("/api/auth/change-password", data);

export const logoutAll = () => api.post("/api/auth/logout-all");
