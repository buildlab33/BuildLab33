"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuthStore } from "@/store/auth";
import { getMe } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setAuth, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    if (!user) {
      getMe()
        .then((res) => {
          const u = res.data;
          setAuth(u, token, localStorage.getItem("refresh_token") || "");
        })
        .catch(() => {
          router.push("/login");
        });
    }
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
