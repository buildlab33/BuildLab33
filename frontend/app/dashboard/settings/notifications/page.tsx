"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { updateMe } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

const EVENTS = [
  { key: "post_approved", label: "Post approved", description: "When one of your posts is approved" },
  { key: "post_rejected", label: "Post rejected", description: "When one of your posts is rejected" },
  { key: "post_scheduled", label: "Post scheduled", description: "When a post is added to the schedule" },
  { key: "brand_created", label: "Brand created", description: "When a new brand is added to the workspace" },
  { key: "brand_archived", label: "Brand archived", description: "When a brand is archived" },
  { key: "user_invited", label: "User invited", description: "When you send a new team invitation" },
] as const;

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const prefs = (user as unknown as { preferences?: { notifications?: Record<string, boolean> } })
    ?.preferences?.notifications ?? {};

  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(EVENTS.map((e) => [e.key, prefs[e.key] !== false]))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "Notifications · Settings"; }, []);

  useEffect(() => {
    if (Object.keys(prefs).length > 0) {
      setToggles(Object.fromEntries(EVENTS.map((e) => [e.key, prefs[e.key] !== false])));
    }
  }, [user?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMe({ preferences: { notifications: toggles } });
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Choose which events trigger an email" />
      <div className="max-w-lg">
        <Card>
          <CardHeader><CardTitle>Email Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {EVENTS.map((event) => (
            <div key={event.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-text-primary">{event.label}</p>
                <p className="text-xs text-text-muted">{event.description}</p>
              </div>
              <Toggle
                checked={toggles[event.key]}
                onChange={(val) => setToggles((t) => ({ ...t, [event.key]: val }))}
              />
            </div>
          ))}
          <div className="pt-4">
            <Button className="w-full" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
