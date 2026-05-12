"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface ClashingPost {
  id: string;
  text: string;
  platform: string;
  scheduled_at: string;
}

interface ClashModalProps {
  clashingPost: ClashingPost;
  onKeepBoth: () => Promise<void>;
  onReplace: () => Promise<void>;
  onPickDifferentTime: () => void;
  submitting: boolean;
}

function formatDt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function ClashModal({ clashingPost, onKeepBoth, onReplace, onPickDifferentTime, submitting }: ClashModalProps) {
  const [replaceConfirming, setReplaceConfirming] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-bold text-text-primary mb-1">Scheduling Clash</h2>
        <p className="text-sm text-text-muted mb-4">
          There is already a <strong>{clashingPost.platform}</strong> post scheduled for this day:
        </p>
        <div className="bg-elevated rounded-lg p-3 mb-4 text-sm text-text-primary">
          <div className="text-xs text-text-muted mb-1">{formatDt(clashingPost.scheduled_at)}</div>
          <div className="leading-relaxed">
            {clashingPost.text.length > 100 ? clashingPost.text.slice(0, 100) + "…" : clashingPost.text}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={onKeepBoth}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Scheduling…" : "Keep Both"}
          </Button>

          {!replaceConfirming ? (
            <Button
              variant="ghost"
              onClick={() => setReplaceConfirming(true)}
              disabled={submitting}
              className="w-full border border-border"
            >
              Replace Existing Post
            </Button>
          ) : (
            <div className="border border-error/40 rounded-lg p-3 bg-red-50 dark:bg-red-950/20">
              <p className="text-xs text-error mb-3">
                This will move the existing post back to draft. It will need re-approval before it can be scheduled again. Continue?
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={onReplace}
                  disabled={submitting}
                  className="flex-1 text-sm bg-error hover:bg-error/90 text-white"
                >
                  {submitting ? "Replacing…" : "Confirm Replace"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setReplaceConfirming(false)}
                  disabled={submitting}
                  className="flex-1 text-sm border border-border"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={onPickDifferentTime}
            disabled={submitting}
            className="w-full text-text-muted border border-border"
          >
            Pick a Different Time
          </Button>
        </div>
      </div>
    </div>
  );
}
