"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Sparkles, FileText, Calendar,
  Newspaper, Users, Send, UserCheck, Briefcase, Settings, LogOut, Menu, X, Bell
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getNotifications, getUnreadCount, markNotificationsRead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/generate", label: "Generate", icon: Sparkles },
  { href: "/dashboard/posts", label: "Posts", icon: FileText },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/news", label: "News Feed", icon: Newspaper },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/outreach", label: "Outreach", icon: Send },
  { href: "/dashboard/clients", label: "Clients", icon: UserCheck },
  { href: "/dashboard/brands", label: "Brands", icon: Briefcase },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Array<{
    id: string; type: string; message: string;
    link: string | null; read: boolean; created_at: string;
  }>>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  // Poll unread count every 60s
  useEffect(() => {
    const fetchCount = () =>
      getUnreadCount().then((r) => setUnread(r.data.count)).catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBellClick = async () => {
    if (!panelOpen) {
      const res = await getNotifications().catch(() => ({ data: [] }));
      const sorted = [...(res.data as typeof notifications)].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotifications(sorted);
    }
    setPanelOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    await markNotificationsRead();
    setNotifications((n) => n.map((item) => ({ ...item, read: true })));
    setUnread(0);
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const navContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-text-primary leading-none">COP Platform</div>
            <div className="text-xs text-text-muted mt-0.5">BuildLab33</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto min-h-0">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150",
              isActive(href)
                ? "bg-primary-muted border border-primary/20 text-text-active font-semibold"
                : "text-text-muted hover:bg-elevated hover:text-text-primary"
            )}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Bell */}
      <div className="px-3 py-2 border-t border-border flex-shrink-0 relative" ref={panelRef}>
        <button
          onClick={handleBellClick}
          className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-text-muted hover:bg-elevated hover:text-text-primary transition-colors text-sm"
        >
          <Bell size={16} className="flex-shrink-0" />
          <span>Notifications</span>
          {unread > 0 && (
            <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-error text-white text-[10px] font-bold px-1">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {panelOpen && (
          <div className="fixed bottom-20 left-[228px] w-72 bg-surface border border-border rounded-xl shadow-xl z-[100] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold text-text-primary">Notifications</span>
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-text-muted hover:text-text-active transition-colors"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">No notifications yet</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-elevated transition-colors ${!n.read ? "bg-primary-muted" : ""}`}
                    onClick={() => {
                      markNotificationsRead([n.id]);
                      setNotifications((prev) =>
                        prev.map((item) => item.id === n.id ? { ...item, read: true } : item)
                      );
                      setUnread((c) => Math.max(0, c - 1));
                      if (n.link) router.push(n.link);
                      setPanelOpen(false);
                    }}
                  >
                    <p className="text-xs text-text-primary">{n.message}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User */}
      <div className="px-3 py-4 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Avatar fallback={(user?.name ?? user?.email ?? "U")[0].toUpperCase()} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-text-primary truncate">
              {user?.name ?? user?.email ?? "User"}
            </div>
            <div className="text-xs text-text-muted capitalize">{user?.role?.replace("_", " ") ?? "user"}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center w-full text-xs text-text-muted hover:text-error transition-colors mt-1"
        >
          <div className="w-7 flex-shrink-0 flex items-center justify-center">
            <LogOut size={14} />
          </div>
          <span className="ml-3">Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] bg-sidebar border-r border-border flex-shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-surface border border-border text-text-secondary"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-[220px] bg-sidebar border-r border-border transition-transform duration-200 overflow-hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
