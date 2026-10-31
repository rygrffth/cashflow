"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV !== "production") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log("Unregistered service worker in dev mode");
              }
            });
          }
        });
        return;
      }

      const register = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered with scope: ", registration.scope);

            // If a worker is waiting, activate it
            if (registration.waiting) {
              registration.waiting.postMessage({ type: "SKIP_WAITING" });
            }

            // Check for updates on subsequent visit
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    // New update available, activate it safely
                    installingWorker.postMessage({ type: "SKIP_WAITING" });
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.error("Service Worker registration failed: ", error);
          });
      };

      // Safari & WebKit PWA guard:
      // In Safari/iOS standalone PWA, controllerchange can fire repeatedly on first load or back/forward navigation.
      // We protect against infinite loops with in-memory flag + sessionStorage timestamp debounce.
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;

        try {
          const lastReloadStr = sessionStorage.getItem("sw_last_reload");
          const now = Date.now();
          // If we reloaded less than 10 seconds ago due to SW, DO NOT reload again!
          if (lastReloadStr && now - Number(lastReloadStr) < 10000) {
            console.warn("Prevented SW infinite reload loop in Safari/PWA");
            return;
          }
          sessionStorage.setItem("sw_last_reload", String(now));
        } catch (e) {
          // If sessionStorage is restricted (e.g. private mode Safari)
        }

        refreshing = true;
        window.location.reload();
      });

      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register);
        return () => window.removeEventListener("load", register);
      }
    }
  }, []);

  return null;
}
