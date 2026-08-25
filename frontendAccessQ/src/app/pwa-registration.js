"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return undefined;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });

        // Recherche immédiatement une nouvelle politique de cache après chaque
        // déploiement au lieu d'attendre le contrôle périodique du navigateur.
        await registration.update();
      } catch (registrationError) {
        console.error("SW registration failed: ", registrationError);
      }
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return undefined;
    }

    window.addEventListener("load", registerServiceWorker);
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}
