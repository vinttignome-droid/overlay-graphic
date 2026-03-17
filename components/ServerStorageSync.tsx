"use client";

import { useEffect } from "react";
import { markServerSyncDone } from "@/lib/serverSyncSignal";

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

    // Alustava synkronointi kuten ennen
    const initSync = async () => {
      try {
        const response = await fetch("/api/storage", { cache: "no-store" });
        const data = (await response.json()) as { entries?: Record<string, string> };
        const serverEntries = data?.entries && typeof data.entries === "object" ? data.entries : {};
        if (cancelled) return;

        const serverKeys = Object.keys(serverEntries);
        if (serverKeys.length > 0) {
          const rawStorage = window.localStorage as Storage & { __originalSetItem?: Storage["setItem"] };
          const directSetItem = rawStorage.__originalSetItem
            ? rawStorage.__originalSetItem.bind(rawStorage)
            : window.localStorage.setItem.bind(window.localStorage);
          serverKeys.forEach((key) => {
            if (!shouldSyncKey(key)) return;
            directSetItem(key, serverEntries[key]);
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

      if (!cancelled) {
        markServerSyncDone();
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

    // POLLING: Hae serveriltä uusin data 5s välein ja päivitä localStorageen jos muuttunut
    let lastServerEntries: Record<string, string> = {};
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/storage", { cache: "no-store" });
        const data = (await response.json()) as { entries?: Record<string, string> };
        const serverEntries = data?.entries && typeof data.entries === "object" ? data.entries : {};
        // Päivitä localStorage vain jos data muuttui
        const changed = Object.keys(serverEntries).some(
          (key) => shouldSyncKey(key) && serverEntries[key] !== lastServerEntries[key]
        ) || Object.keys(lastServerEntries).some(
          (key) => shouldSyncKey(key) && !(key in serverEntries)
        );
        if (changed) {
          const rawStorage = window.localStorage as Storage & { __originalSetItem?: Storage["setItem"] };
          const directSetItem = rawStorage.__originalSetItem
            ? rawStorage.__originalSetItem.bind(rawStorage)
            : window.localStorage.setItem.bind(window.localStorage);
          Object.keys(serverEntries).forEach((key) => {
            if (!shouldSyncKey(key)) return;
            directSetItem(key, serverEntries[key]);
          });
          // Poista localStoragesta avaimet joita ei enää ole serverillä
          Object.keys(lastServerEntries).forEach((key) => {
            if (!shouldSyncKey(key)) return;
            if (!(key in serverEntries)) {
              window.localStorage.removeItem(key);
            }
          });
          lastServerEntries = { ...serverEntries };
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, []);

  return null;
}
