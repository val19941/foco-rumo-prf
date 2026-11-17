import { toast } from "sonner";

const SCOPE = "/notify/";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

async function getWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SCOPE);
    const reg = existing ?? (await navigator.serviceWorker.register("/notifications-sw.js", { scope: SCOPE }));
    if (reg.active) return reg;
    const sw = reg.installing ?? reg.waiting;
    if (!sw) return reg;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 4000);
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") {
          clearTimeout(t);
          resolve();
        }
      });
    });
    return reg;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  const p = await Notification.requestPermission();
  if (p === "granted") await getWorker();
  return p;
}

/** Shows an in-app toast and, when permitted, a system notification. */
export async function notify(title: string, body: string, opts: { tag?: string; url?: string } = {}) {
  toast(title, { description: body });
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* ignore */
  }
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    tag: opts.tag ?? title,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: opts.url ?? "/" },
  };
  const reg = await getWorker();
  if (reg?.active) {
    await reg.showNotification(title, options);
    return;
  }
  try {
    new Notification(title, options);
  } catch {
    /* Some Android browsers only allow notifications through a worker. */
  }
}
