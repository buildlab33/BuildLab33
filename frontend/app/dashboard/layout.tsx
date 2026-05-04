"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setAuth, loadFromStorage, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const handleInactivityLogout = useCallback(() => {
    clearAuth();
    router.push("/login?reason=inactive");
  }, [clearAuth, router]);

  useInactivityLogout({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    onLogout: handleInactivityLogout,
  });

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      loadFromStorage();
      const token = localStorage.getItem("access_token");
      if (!token) { router.push("/login"); return; }
      try {
        const res = await getMe();
        setAuth(res.data, token, localStorage.getItem("refresh_token") ?? "");
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, setAuth, loadFromStorage]);

  if (!mounted || loading) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
