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

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const login = (email: string, password: string) =>
  api.post("/api/auth/login", { email, password });

export const signup = (email: string, password: string, name: string) =>
  api.post("/api/auth/signup", { email, password, name });

export const getMe = () => api.get("/api/auth/me");

// Brands
export const getBrands = () => api.get("/api/brands");
export const getBrand = (id: string) => api.get(`/api/brands/${id}`);

// Generate
export const generatePost = (payload: {
  brand_id: string;
  platform: string;
  campaign_goal: string;
  audience: string;
  content_format?: string;
  growth_angle?: string;
  news_hook?: string;
}) => api.post("/api/generate", payload);
