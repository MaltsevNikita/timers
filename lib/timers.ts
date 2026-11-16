import type { TimerItem } from "@/lib/types";

export function isTimerItem(value: unknown): value is TimerItem {
  if (!value || typeof value !== "object") return false;
  const timer = value as Partial<TimerItem>;

  return (
    typeof timer.id === "string" &&
    typeof timer.name === "string" &&
    typeof timer.durationMs === "number" &&
    timer.durationMs > 0 &&
    typeof timer.remainingMs === "number" &&
    (timer.endsAt === null || typeof timer.endsAt === "number") &&
    (timer.status === "running" || timer.status === "paused" || timer.status === "finished") &&
    typeof timer.alarm === "boolean" &&
    typeof timer.createdAt === "number"
  );
}

/** Восстанавливает таймеры после перезагрузки: истёкшие помечает завершёнными без звука. */
export function restoreTimers(raw: unknown): TimerItem[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();

  return raw.filter(isTimerItem).map((timer) => {
    if (timer.status === "finished") {
      // После перезагрузки не запускаем сигнал без действия пользователя.
      return { ...timer, endsAt: null, remainingMs: 0, alarm: false };
    }
    if (timer.status === "running") {
      if (timer.endsAt === null) {
        return { ...timer, status: "paused", remainingMs: Math.max(0, timer.remainingMs) };
      }
      if (timer.endsAt <= now) {
        return { ...timer, status: "finished", endsAt: null, remainingMs: 0, alarm: false };
      }
    }
    return timer;
  });
}
