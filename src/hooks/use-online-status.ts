import { useEffect, useState } from "react";

/** Tracks browser connectivity. Starts optimistic to avoid SSR mismatches. */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    setIsOnline(navigator.onLine);
    if (!navigator.onLine) setWasOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
