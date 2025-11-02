"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, LocalUserChoices, useLocalParticipant, useTracks } from "@livekit/components-react";
import { Button } from "@live-art/ui";

function PublisherInner() {
  const { localParticipant } = useLocalParticipant();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!localParticipant) return;
  }, [localParticipant]);

  return (
    <div className="space-y-2">
      <div className="aspect-video bg-neutral-900 rounded border border-neutral-800">
        {/* LiveKit components auto-render tracks in the room container */}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => setEnabled((v) => !v)}>{enabled ? "Stop Preview" : "Start Preview"}</Button>
      </div>
    </div>
  );
}

export function LivekitPublisher({ url, token }: { url: string; token: string }) {
  return (
    <LiveKitRoom serverUrl={url} token={token} connect options={{ dynacast: true }}>
      <LocalUserChoices />
      <PublisherInner />
    </LiveKitRoom>
  );
}
