export const SYNC_DONE_EVENT = "ligr:server-sync-done";

type WindowWithSync = Window & { __ligrSyncDone?: boolean };

export const isServerSyncDone = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean((window as WindowWithSync).__ligrSyncDone);
};

export const markServerSyncDone = () => {
  if (typeof window === "undefined") return;
  (window as WindowWithSync).__ligrSyncDone = true;
  window.dispatchEvent(new CustomEvent(SYNC_DONE_EVENT));
};
