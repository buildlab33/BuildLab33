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

export const getBrands = () => api.get("/api/brands");
export const getBrand = (id: string) => api.get(`/api/brands/${id}`);

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
