"use client";
import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { updateMe } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "@/components/ui/toast";
import { Moon, Sun } from "lucide-react";

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const isDayMode = theme === "day";
  const [saving, setSaving] = useState(false);

  const handleToggle = async (day: boolean) => {
    const next = day ? "day" : "night";
    setTheme(next); // Apply instantly
    setSaving(true);
    try {
      await updateMe({ preferences: { theme: next } });
    } catch {
      // Revert on failure
      setTheme(day ? "night" : "day");
      toast.error("Failed to save theme preference");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDayMode ? <Sun className="w-5 h-5 text-warning" /> : <Moon className="w-5 h-5 text-text-muted" />}
              <div>
                <p className="text-sm font-medium text-text-primary">{isDayMode ? "Day mode" : "Night mode"}</p>
                <p className="text-xs text-text-muted">{isDayMode ? "Light background, dark text" : "Dark background, light text"}</p>
              </div>
            </div>
            <Toggle checked={isDayMode} onChange={handleToggle} disabled={saving} label="Toggle day/night mode" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
