"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      const { user, access_token, refresh_token } = res.data;
      setAuth(user, access_token, refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f8fa",
    }}>
      <div className="card" style={{ width: 380 }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "#6366f1", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 24, fontWeight: 700,
          }}>C</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>COP Platform</h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div style={{
              background: "#fef2f2", color: "#dc2626",
              padding: "10px 14px", borderRadius: 8,
              fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
