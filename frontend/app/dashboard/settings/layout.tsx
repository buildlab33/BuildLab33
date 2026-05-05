"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { User, Shield, Sun, Bell, Users } from "lucide-react";

const NAV = [
  { group: "Account", items: [
    { href: "/dashboard/settings/profile", label: "Profile", icon: User },
    { href: "/dashboard/settings/security", label: "Security", icon: Shield },
    { href: "/dashboard/settings/appearance", label: "Appearance", icon: Sun },
    { href: "/dashboard/settings/notifications", label: "Notifications", icon: Bell },
  ]},
];

const ADMIN_NAV = [
  { group: "Admin", items: [
    { href: "/dashboard/settings/team", label: "Team & Users", icon: Users },
  ]},
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const groups = isSuperAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* Left nav */}
      <aside className="w-48 flex-shrink-0">
        {groups.map((group) => (
          <div key={group.group} className="mb-6">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-2">
              {group.group}
            </p>
            <nav className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                    pathname === href
                      ? "bg-primary-muted border border-primary/20 text-text-active font-semibold"
                      : "text-text-muted hover:bg-elevated hover:text-text-primary"
                  )}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
