export type TimerStatus = "running" | "paused" | "finished";

export interface TimerItem {
  id: string;
  name: string;
  /** Полная длительность таймера в миллисекундах. */
  durationMs: number;
  /** Остаток на момент паузы (для running считается от endsAt). */
  remainingMs: number;
  /** Абсолютное время окончания, пока таймер идёт. */
  endsAt: number | null;
  status: TimerStatus;
  /** true — сигнал ещё звучит и требует «Стоп». */
  alarm: boolean;
  createdAt: number;
}

export type SoundModeKind = "default" | "custom";

/** Доступные уровни громкости сигнала: обычный и усиленный. */
export const VOLUME_LEVELS = [1, 1.25, 1.5, 2] as const;

export type VolumeLevel = (typeof VOLUME_LEVELS)[number];

export function normalizeVolume(value: string | number | null | undefined): VolumeLevel {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return (VOLUME_LEVELS as readonly number[]).includes(parsed) ? (parsed as VolumeLevel) : 1;
}
