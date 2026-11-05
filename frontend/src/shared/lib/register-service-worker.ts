let registration: Promise<ServiceWorkerRegistration> | undefined;

// One root worker serves both PWA caching and FCM, without remote imports.
export function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext)
    return Promise.reject(new Error("Service workers unavailable"));
  if (!registration) {
    registration = navigator.serviceWorker.register("/sw.js", {
      scope: "/", updateViaCache: "none",
    }).then(async (result) => {
      if (result.active) return result;
      await new Promise<void>((resolve, reject) => {
        const worker = result.installing || result.waiting;
        if (!worker) { reject(new Error("No service worker")); return; }
        const timer = setTimeout(() => { cleanup(); reject(new Error("Worker activation timeout")); }, 10_000);
        const changed = () => {
          if (worker.state === "activated") { cleanup(); resolve(); }
          if (worker.state === "redundant") { cleanup(); reject(new Error("Worker installation failed")); }
        };
        const cleanup = () => { clearTimeout(timer); worker.removeEventListener("statechange", changed); };
        worker.addEventListener("statechange", changed);
        changed();
      });
      return result;
    }).catch((error: unknown) => { registration = undefined; throw error; });
  }
  return registration;
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const register = () => { void ensureServiceWorker().catch(() => {}); };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
