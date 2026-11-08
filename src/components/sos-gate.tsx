"use client";

import { useState } from "react";
import { PinGate } from "@/components/pin-gate";
import { SosPanel } from "@/components/sos-panel";

/**
 * Switches between the PIN screen and the SOS interface. The server decides
 * whether the visitor already holds a valid session; after a successful PIN
 * submission (the cookie is already set) this flips client-side with no
 * reload.
 */
export function SosGate({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);

  if (authenticated) {
    return <SosPanel />;
  }
  return <PinGate onAuthenticated={() => setAuthenticated(true)} />;
}
