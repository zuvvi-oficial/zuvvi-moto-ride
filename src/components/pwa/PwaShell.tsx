import { useEffect } from "react";
import { ConnectionStatus } from "./ConnectionStatus";
import { InstallZuvvi } from "./InstallZuvvi";
import { UpdatePrompt } from "./UpdatePrompt";
import { registerZuvviServiceWorker } from "@/lib/pwa/register-sw";

/** PWA infrastructure layer: SW registration + connectivity/install/update UI. */
export function PwaShell() {
  useEffect(() => {
    void registerZuvviServiceWorker();
  }, []);

  return (
    <>
      <ConnectionStatus />
      <UpdatePrompt />
      <InstallZuvvi />
    </>
  );
}
