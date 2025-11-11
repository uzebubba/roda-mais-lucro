const TIP_PREFIX = "bubbapp_tip_";

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
};

export type EducationalTipKey =
  | "fuel-page"
  | "fixed-page"
  | "first-transaction"
  | "daily-goal";

export const hasSeenEducationalTip = (key: EducationalTipKey): boolean => {
  const storage = getStorage();
  if (!storage) {
    return false;
  }
  return storage.getItem(`${TIP_PREFIX}${key}`) === "seen";
};

export const markEducationalTipSeen = (key: EducationalTipKey) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(`${TIP_PREFIX}${key}`, "seen");
  } catch (_error) {
    // ignore write failures
  }
};

export const triggerEducationalTip = (
  key: EducationalTipKey,
  action: () => void,
): boolean => {
  if (hasSeenEducationalTip(key)) {
    return false;
  }
  action();
  markEducationalTipSeen(key);
  return true;
};
