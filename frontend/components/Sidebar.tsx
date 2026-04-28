"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dashboard/generate", label: "Generate", icon: "✦" },
  { href: "/dashboard/posts", label: "Posts", icon: "☰" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "◻" },
  { href: "/dashboard/leads", label: "Leads", icon: "◈" },
  { href: "/dashboard/outreach", label: "Outreach", icon: "◎" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <div className="sidebar" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        {/* Logo */}
        <div style={{ padding: "24px 20px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "#6366f1", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 16, fontWeight: 700,
          }}>C</div>
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>COP Platform</span>
        </div>

        {/* Nav */}
        <nav style={{ marginTop: 8 }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* User */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ color: "#a0aec0", fontSize: 13, marginBottom: 8 }}>
          <div style={{ color: "white", fontWeight: 600 }}>{user?.name || "User"}</div>
          <div style={{ fontSize: 12 }}>{user?.email}</div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "#a0aec0",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
