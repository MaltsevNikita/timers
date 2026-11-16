"use client";

import { useState, useSyncExternalStore } from "react";
import { BellIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

interface NotificationToggleProps {
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
}

const subscribe = () => () => {};

export function NotificationToggle({ enabled, onEnable, onDisable }: NotificationToggleProps) {
  const supported = useSyncExternalStore(
    subscribe,
    () => typeof window !== "undefined" && "Notification" in window,
    () => false,
  );

  const permission = useSyncExternalStore<NotificationPermission>(
    subscribe,
    () => (typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"),
    () => "default",
  );

  // После запроса разрешения пересчитываем состояние без ожидания внешнего события.
  const [requested, setRequested] = useState<NotificationPermission | null>(null);
  const currentPermission = requested ?? permission;

  async function handleClick() {
    if (!supported) return;

    if (enabled) {
      onDisable();
      return;
    }

    if (currentPermission === "granted") {
      onEnable();
      return;
    }

    if (currentPermission === "denied") return;

    const result = await Notification.requestPermission();
    setRequested(result);
    if (result === "granted") onEnable();
  }

  const denied = currentPermission === "denied";
  const active = enabled && !denied;

  const title = !supported
    ? "Браузер не поддерживает уведомления"
    : denied
      ? "Уведомления заблокированы в настройках браузера"
      : active
        ? "Уведомления включены"
        : "Включить уведомления о завершении";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!supported || denied}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "grid size-9 place-items-center rounded-xl transition",
        active
          ? "bg-accent-soft text-accent"
          : "text-muted hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/10",
        (!supported || denied) && "cursor-not-allowed opacity-40",
      )}
    >
      <BellIcon size={18} filled={active} />
    </button>
  );
}
