const SUPABASE_PROJECT_REF = "qwjfimrqpomeqlsrquej";

export const REMEMBER_ME_STORAGE_KEY = "rml:rememberMe";
export const SUPABASE_AUTH_TOKEN_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const createMemoryStorage = (): StorageAdapter => {
  const store = new Map<string, string>();

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

const getPreferredBrowserStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const remember = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === "true";
  return remember ? window.localStorage : window.sessionStorage;
};

const clearOtherStorage = (activeStorage: Storage, key: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const otherStorage = activeStorage === window.localStorage ? window.sessionStorage : window.localStorage;
  otherStorage.removeItem(key);
};

export const createSupabaseAuthStorage = (): StorageAdapter => {
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }

  return {
    getItem: (key) => {
      const activeStorage = getPreferredBrowserStorage();
      if (!activeStorage) {
        return null;
      }

      return activeStorage.getItem(key);
    },
    setItem: (key, value) => {
      const activeStorage = getPreferredBrowserStorage();
      if (!activeStorage) {
        return;
      }

      activeStorage.setItem(key, value);
      clearOtherStorage(activeStorage, key);
    },
    removeItem: (key) => {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    },
  };
};

export const getRememberMePreference = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === "true";
};

export const setRememberMePreference = (remember: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  if (remember) {
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, "true");
  } else {
    window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
  }

  window.localStorage.removeItem(SUPABASE_AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(SUPABASE_AUTH_TOKEN_KEY);
};
