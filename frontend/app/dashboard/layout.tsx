"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setAuth, loadFromStorage } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

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
