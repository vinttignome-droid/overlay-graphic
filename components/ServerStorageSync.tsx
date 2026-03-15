"use client";

import { useEffect } from "react";

const SYNC_KEY_PREFIXES = ["ligr:"];
const EXTRA_SYNC_KEYS = new Set(["isAdmin"]);

const shouldSyncKey = (key: string) => SYNC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) || EXTRA_SYNC_KEYS.has(key);

const collectSyncEntries = () => {
  const entries: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !shouldSyncKey(key)) continue;
    const value = window.localStorage.getItem(key);
    if (typeof value !== "string") continue;
    entries[key] = value;
  }
  return entries;
};

export default function ServerStorageSync() {
  useEffect(() => {
    let cancelled = false;

    const postUpdate = async (payload: Record<string, unknown>) => {
      try {
        await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Ignore transient network errors and rely on future updates.
      }
    };

    const initSync = async () => {
      try {
        const response = await fetch("/api/storage", { cache: "no-store" });
        const data = (await response.json()) as { entries?: Record<string, string> };
        const serverEntries = data?.entries && typeof data.entries === "object" ? data.entries : {};
        if (cancelled) return;

        const serverKeys = Object.keys(serverEntries);
        if (serverKeys.length > 0) {
          serverKeys.forEach((key) => {
            if (!shouldSyncKey(key)) return;
            window.localStorage.setItem(key, serverEntries[key]);
          });
        } else {
          const localEntries = collectSyncEntries();
          if (Object.keys(localEntries).length > 0) {
            await postUpdate({ type: "sync", entries: localEntries });
          }
        }
      } catch {
        // If bootstrap fails we keep local behavior and continue with local updates.
      }

      const storage = window.localStorage as Storage & {
        __serverSyncPatched?: boolean;
        __originalSetItem?: Storage["setItem"];
        __originalRemoveItem?: Storage["removeItem"];
      };

      if (storage.__serverSyncPatched) return;

      const originalSetItem = storage.setItem.bind(storage);
      const originalRemoveItem = storage.removeItem.bind(storage);

      storage.__originalSetItem = storage.setItem;
      storage.__originalRemoveItem = storage.removeItem;
      storage.__serverSyncPatched = true;

      storage.setItem = (key: string, value: string) => {
        originalSetItem(key, value);
        if (shouldSyncKey(key)) {
          void postUpdate({ type: "set", key, value });
        }
      };

      storage.removeItem = (key: string) => {
        originalRemoveItem(key);
        if (shouldSyncKey(key)) {
          void postUpdate({ type: "remove", key });
        }
      };
    };

    void initSync();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
