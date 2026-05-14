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
  const { setAuth, clearAuth } = useAuthStore();
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
      try {
        const res = await getMe();
        setAuth(res.data);
        // Apply user's DB theme
        if (res.data.theme === "day" || res.data.theme === "night") {
          localStorage.setItem("theme", res.data.theme);
          document.documentElement.setAttribute("data-theme", res.data.theme);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, setAuth]);

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
