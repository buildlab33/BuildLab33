"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Sparkles, FileText, Calendar,
  Newspaper, Users, Send, UserCheck, Briefcase, Settings, LogOut, Menu, X
} from "lucide-react";
import { useState } from "react";
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

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-text-primary leading-none">COP Platform</div>
            <div className="text-xs text-text-muted mt-0.5">BuildLab33</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
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

      {/* User */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 mb-2">
          <Avatar fallback={user?.name ?? "U"} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-text-primary truncate">
              {user?.name ?? "User"}
            </div>
            <div className="text-xs text-text-muted">{user?.role ?? "user"}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-text-muted hover:bg-elevated hover:text-error transition-colors"
        >
          <LogOut size={14} />
          Log out
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
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface border border-border text-text-secondary"
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
          "md:hidden fixed top-0 left-0 z-50 h-full w-[220px] bg-sidebar border-r border-border transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
