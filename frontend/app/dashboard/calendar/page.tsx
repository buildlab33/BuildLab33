"use client";
import { useRouter } from "next/navigation";

export default function CalendarPage() {
  const router = useRouter();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Calendar</h1>
        <p style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>
          Schedule and view your posts
        </p>
      </div>

      <div className="card" style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>◻</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Coming Soon</div>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>Calendar view is coming in Phase 2</p>
        <button className="btn-primary" onClick={() => router.push("/dashboard/generate")}>
          ✦ Generate Content Instead
        </button>
      </div>
    </div>
  );
}
