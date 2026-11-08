"use client";

import { useSyncExternalStore } from "react";

/**
 * External-store wrappers over window.localStorage.
 *
 * React's sanctioned way to read browser storage across SSR and hydration is
 * useSyncExternalStore: no setState-inside-effect cascades, the first client
 * render already sees the stored value, and multi-tab changes re-render.
 * All access fails soft when storage is unavailable (private mode, quota).
 */

type Listener = () => void;

class NumberStore {
  private readonly key: string;
  private readonly listeners = new Set<Listener>();
  private readonly storageListener: (event: StorageEvent) => void;

  constructor(key: string) {
    this.key = key;
    this.storageListener = (event) => {
      if (event.key === null || event.key === this.key) {
        this.emit();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", this.storageListener);
    }
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Current raw value, or null when missing/unreadable. */
  get = (): number | null => {
    return readRawNumber(this.key);
  };

  set = (value: number): void => {
    writeRawNumber(this.key, value);
    this.emit();
  };

  remove = (): void => {
    removeRawNumber(this.key);
    this.emit();
  };

  private emit(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

/**
 * A deadline in milliseconds since epoch. get() deliberately answers null
 * once the deadline has passed, so consumers can treat "null" as "not
 * active" without comparing against Date.now() while rendering.
 */
export type DeadlineStore = {
  subscribe(listener: Listener): () => void;
  get(): number | null;
  /** Arm the deadline a given number of seconds into the future. */
  extendBy(seconds: number): void;
  clear(): void;
};

export type NumberStoreView = {
  subscribe(listener: Listener): () => void;
  get(): number | null;
  set(value: number): void;
  remove(): void;
};

const numberStores = new Map<string, NumberStore>();

function numberStoreFor(key: string): NumberStore {
  let store = numberStores.get(key);
  if (store === undefined) {
    store = new NumberStore(key);
    numberStores.set(key, store);
  }
  return store;
}

const SERVER_SNAPSHOT: null = null;

export function getNumberStore(key: string): NumberStoreView {
  const store = numberStoreFor(key);
  return {
    subscribe: store.subscribe,
    get: store.get,
    set: store.set,
    remove: store.remove,
  };
}

export function getDeadlineStore(key: string): DeadlineStore {
  const base = numberStoreFor(key);
  return {
    subscribe: base.subscribe,
    get: () => {
      const deadline = base.get();
      if (deadline === null || deadline <= Date.now()) {
        return null;
      }
      return deadline;
    },
    extendBy: (seconds) => {
      base.set(Date.now() + seconds * 1000);
    },
    clear: base.remove,
  };
}

/** Reactive read of a raw number (attempts counter, …). */
export function useNumberStore(key: string): number | null {
  const store = getNumberStore(key);
  return useSyncExternalStore(store.subscribe, store.get, () => SERVER_SNAPSHOT);
}

/** Reactive read of a deadline; null means "no active deadline". */
export function useDeadlineStore(key: string): number | null {
  const store = getDeadlineStore(key);
  return useSyncExternalStore(store.subscribe, store.get, () => SERVER_SNAPSHOT);
}

function readRawNumber(key: string): number | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeRawNumber(key: string, value: number): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // Storage unavailable: the feature degrades gracefully.
  }
}

function removeRawNumber(key: string): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}
