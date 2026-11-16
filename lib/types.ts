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
