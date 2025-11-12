import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatKm } from "@/lib/km";

const OIL_REMINDER_THRESHOLD_KM = 500;
const OIL_REMINDER_MIN_THRESHOLD_KM = 200;
const OIL_REMINDER_THRESHOLD_PERCENT = 0.2;
const OIL_REMINDER_SNOOZE_DURATION_MS = 1000 * 60 * 60 * 24 * 3;
const OIL_REMINDER_STORAGE_KEY = "fixas-oil-reminder-snoozed-until";

type UseOilReminderAlertProps = {
  currentKm: number;
  intervalKm: number;
  lastChangeKm: number;
  autoToast?: boolean;
};

const isBrowser = () => typeof window !== "undefined";

const loadSnoozedUntil = (): number | null => {
  if (!isBrowser()) {
    return null;
  }
  const stored = window.localStorage.getItem(OIL_REMINDER_STORAGE_KEY);
  if (!stored) {
    return null;
  }
  const parsed = Number.parseInt(stored, 10);
  if (Number.isNaN(parsed)) {
    window.localStorage.removeItem(OIL_REMINDER_STORAGE_KEY);
    return null;
  }
  return parsed;
};

const persistSnoozedUntil = (timestamp: number | null) => {
  if (!isBrowser()) {
    return;
  }
  if (timestamp) {
    window.localStorage.setItem(OIL_REMINDER_STORAGE_KEY, timestamp.toString());
  } else {
    window.localStorage.removeItem(OIL_REMINDER_STORAGE_KEY);
  }
};

export const useOilReminderAlert = ({
  currentKm,
  intervalKm,
  lastChangeKm,
  autoToast = true,
}: UseOilReminderAlertProps) => {
  const [reminderSnoozedUntil, setReminderSnoozedUntil] = useState<number | null>(
    () => loadSnoozedUntil(),
  );
  const reminderToastShownRef = useRef(false);

  const updateSnooze = useCallback((timestamp: number | null) => {
    setReminderSnoozedUntil(timestamp);
    persistSnoozedUntil(timestamp);
  }, []);

  const handleSnoozeReminder = useCallback(() => {
    const snoozeUntil = Date.now() + OIL_REMINDER_SNOOZE_DURATION_MS;
    updateSnooze(snoozeUntil);
    toast.info("Lembraremos você dessa troca em 3 dias.");
  }, [updateSnooze]);

  const clearReminderSnooze = useCallback(() => {
    updateSnooze(null);
  }, [updateSnooze]);

  useEffect(() => {
    if (!isBrowser() || reminderSnoozedUntil === null) {
      return;
    }
    if (reminderSnoozedUntil <= Date.now()) {
      updateSnooze(null);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      updateSnooze(null);
    }, reminderSnoozedUntil - Date.now());
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reminderSnoozedUntil, updateSnooze]);

  const reminderThresholdKm = useMemo(() => {
    if (intervalKm <= 0) {
      return OIL_REMINDER_THRESHOLD_KM;
    }
    const percentageValue = Math.round(intervalKm * OIL_REMINDER_THRESHOLD_PERCENT);
    return Math.max(
      OIL_REMINDER_MIN_THRESHOLD_KM,
      Math.min(OIL_REMINDER_THRESHOLD_KM, percentageValue),
    );
  }, [intervalKm]);

  const nextChangeKm = useMemo(
    () => lastChangeKm + intervalKm,
    [lastChangeKm, intervalKm],
  );
  const kmRemaining = useMemo(
    () => nextChangeKm - currentKm,
    [nextChangeKm, currentKm],
  );
  const kmSinceLast = useMemo(
    () => Math.max(0, currentKm - lastChangeKm),
    [currentKm, lastChangeKm],
  );
  const overdue = kmRemaining <= 0;

  const reminderSnoozed =
    reminderSnoozedUntil !== null && reminderSnoozedUntil > Date.now();

  const shouldShowReminderBanner = useMemo(() => {
    if (!currentKm || intervalKm <= 0) {
      return false;
    }
    if (!overdue && kmRemaining > reminderThresholdKm) {
      return false;
    }
    return !reminderSnoozed;
  }, [currentKm, intervalKm, overdue, kmRemaining, reminderThresholdKm, reminderSnoozed]);

  const reminderTitle = overdue
    ? "Troca de óleo atrasada"
    : "Troca de óleo chegando";
  const reminderDescription = overdue
    ? `Você passou ${formatKm(Math.abs(kmRemaining))} km do limite configurado.`
    : `Faltam ${formatKm(Math.max(kmRemaining, 0))} km para a próxima troca.`;

  useEffect(() => {
    if (!autoToast) {
      reminderToastShownRef.current = false;
      return;
    }

    if (!shouldShowReminderBanner) {
      reminderToastShownRef.current = false;
      return;
    }

    if (reminderToastShownRef.current) {
      return;
    }

    toast.warning(reminderTitle, {
      description: reminderDescription,
      action: {
        label: "Lembrar depois",
        onClick: handleSnoozeReminder,
      },
    });

    reminderToastShownRef.current = true;
  }, [
    autoToast,
    shouldShowReminderBanner,
    reminderTitle,
    reminderDescription,
    handleSnoozeReminder,
  ]);

  return {
    shouldShowReminderBanner,
    reminderTitle,
    reminderDescription,
    handleSnoozeReminder,
    clearReminderSnooze,
    kmRemaining,
    kmSinceLast,
    overdue,
    reminderThresholdKm,
  };
};
