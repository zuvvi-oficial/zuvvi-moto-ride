import { useEffect, useState } from "react";

export type PwaDisplayMode = "browser" | "standalone" | "fullscreen" | "minimal-ui";

export interface PwaEnvironment {
  displayMode: PwaDisplayMode;
  isInstalled: boolean;
  isIos: boolean;
  isSafari: boolean;
  isHydrated: boolean;
}

function detectDisplayMode(): PwaDisplayMode {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return "minimal-ui";
  // iOS Safari home-screen apps
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return "standalone";
  return "browser";
}

/** Detects how the app is currently being displayed (browser vs installed app). */
export function usePwaDisplayMode(): PwaEnvironment {
  const [state, setState] = useState<PwaEnvironment>({
    displayMode: "browser",
    isInstalled: false,
    isIos: false,
    isSafari: false,
    isHydrated: false,
  });

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
    const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);

    const sync = () => {
      const displayMode = detectDisplayMode();
      setState({
        displayMode,
        isInstalled: displayMode !== "browser",
        isIos,
        isSafari,
        isHydrated: true,
      });
    };

    sync();

    const queries = [
      window.matchMedia("(display-mode: fullscreen)"),
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: minimal-ui)"),
    ];
    queries.forEach((query) => query.addEventListener("change", sync));
    return () => queries.forEach((query) => query.removeEventListener("change", sync));
  }, []);

  return state;
}
