"use client";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";

export default function CalendarPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="Calendar" subtitle="Schedule and view your posts" />
      <EmptyState
        icon={<Calendar size={40} />}
        title="Coming Soon"
        description="The calendar view with scheduling and clash detection is being built next."
        action={
          <Button onClick={() => router.push("/dashboard/generate")}>
            Generate Content
          </Button>
        }
      />
    </div>
  );
}
