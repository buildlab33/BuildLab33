"use client";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";

export default function LeadsPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="Leads" subtitle="Manage your lead pipeline" />
      <EmptyState
        icon={<Users size={40} />}
        title="Coming Soon"
        description="The leads module for tracking and managing your outreach pipeline is being built next."
        action={
          <Button onClick={() => router.push("/dashboard/generate")}>
            Generate Content
          </Button>
        }
      />
    </div>
  );
}
