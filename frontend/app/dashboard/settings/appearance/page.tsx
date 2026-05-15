"use client";
import { useEffect, useState } from "react";
import { useTheme, THEMES, type Theme } from "@/lib/theme";
import { updateMe } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";
import { Check, Loader2 } from "lucide-react";

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState<Theme | null>(null);

  useEffect(() => { document.title = "Appearance · Settings"; }, []);

  const handleSelect = async (next: Theme) => {
    if (next === theme || saving) return;
    setTheme(next);
    setSaving(next);
    try {
      await updateMe({ preferences: { theme: next } });
    } catch {
      setTheme(theme);
      toast.error("Failed to save theme preference");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <PageHeader title="Appearance" subtitle="Choose a theme for your workspace" />
      <Card className="max-w-2xl">
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              const isSaving = saving === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  disabled={!!saving}
                  className={[
                    "group relative flex flex-col rounded-xl border-2 overflow-hidden transition-all duration-150 text-left",
                    isActive
                      ? "border-primary ring-2 ring-primary/30 scale-[1.03]"
                      : "border-border hover:border-primary/50 hover:scale-[1.02]",
                    saving && !isSaving ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                  aria-pressed={isActive}
                  title={t.description}
                >
                  {/* Colour preview */}
                  <div
                    className="h-14 w-full flex items-center justify-center gap-1.5 px-3"
                    style={{ backgroundColor: t.base }}
                  >
                    <div
                      className="h-6 w-6 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: t.surface, border: `1px solid ${t.primary}33` }}
                    />
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.primary }}
                    />
                    <div
                      className="h-2 flex-1 rounded-full"
                      style={{ backgroundColor: t.primary, opacity: 0.35 }}
                    />
                  </div>

                  {/* Label row */}
                  <div
                    className="px-3 py-2 flex items-center justify-between gap-1"
                    style={{ backgroundColor: t.surface }}
                  >
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ color: t.id === "day" ? "#0f172a" : "#f1f5f9" }}
                    >
                      {t.label}
                    </span>
                    {isActive && (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: t.primary }}
                      >
                        {isSaving ? (
                          <Loader2 size={10} className="text-white animate-spin" />
                        ) : (
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        )}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-text-muted">
            Theme is saved to your account and synced across devices.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
