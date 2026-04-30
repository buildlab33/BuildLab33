"use client";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";

export default function OutreachPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="Outreach" subtitle="Manage your outreach sequences" />
      <EmptyState
        icon={<Send size={40} />}
        title="Coming Soon"
        description="The outreach module for drafting and sending outreach messages is being built next."
        action={
          <Button onClick={() => router.push("/dashboard/generate")}>
            Generate Content
          </Button>
        }
      />
    </div>
  );
}
