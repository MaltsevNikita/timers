"use client";

import {
  AlarmIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
} from "@/components/Icons";
import { cn } from "@/lib/cn";
import { formatDuration, formatEndTime, formatMinutes } from "@/lib/format";
import type { TimerItem } from "@/lib/types";

interface TimerCardProps {
  timer: TimerItem;
  now: number;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onReset: (id: string) => void;
  onAddMinute: (id: string) => void;
  onSilence: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TimerCard({
  timer,
  now,
  onPause,
  onResume,
  onReset,
  onAddMinute,
  onSilence,
  onDelete,
}: TimerCardProps) {
  const running = timer.status === "running";
  const paused = timer.status === "paused";
  const finished = timer.status === "finished";

  const remaining =
    running && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
  const progress =
    timer.durationMs > 0 ? Math.min(1, Math.max(0, remaining / timer.durationMs)) : 0;

  return (
    <article
      className={cn(
        "card animate-rise relative overflow-hidden p-5",
        running && "border-accent/25",
        paused && "border-line",
        finished && "alarm-card border-rose-500/40 bg-rose-500/[0.04] dark:bg-rose-500/[0.07]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={cn(
              "truncate text-base font-semibold",
              paused && "text-muted",
              finished && "text-rose-500",
            )}
            title={timer.name}
          >
            {timer.name}
          </h3>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            {running ? (
              <>
                <span className="relative flex size-1.5">
                  <span className="animate-ping-dot absolute inline-flex size-full rounded-full bg-accent" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
                </span>
                <span>Идёт</span>
                {timer.endsAt !== null ? <span>· до {formatEndTime(timer.endsAt)}</span> : null}
              </>
            ) : null}
            {paused ? (
              <>
                <span className="size-1.5 rounded-full bg-muted/60" />
                <span>На паузе</span>
              </>
            ) : null}
            {finished ? (
              <>
                <AlarmIcon size={13} className="text-rose-500" />
                <span className="font-medium text-rose-500">Время вышло</span>
              </>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(timer.id)}
          aria-label={`Удалить таймер «${timer.name}»`}
          title="Удалить"
          className="btn-ghost -mt-1 -mr-1"
        >
          <TrashIcon size={16} />
        </button>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p
          className={cn(
            "font-mono text-[42px] leading-none font-semibold tracking-tight tabular-nums sm:text-5xl",
            paused && "text-muted",
            finished && "text-rose-500",
          )}
        >
          {formatDuration(remaining)}
        </p>
        <p className="pb-1 text-xs text-muted">из {formatMinutes(timer.durationMs)}</p>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-foreground/8 dark:bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            finished
              ? "bg-rose-500"
              : paused
                ? "bg-muted/50"
                : "bg-gradient-to-r from-accent to-amber-400",
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        {finished ? (
          <>
            {timer.alarm ? (
              <button type="button" onClick={() => onSilence(timer.id)} className="btn-danger flex-1">
                <PauseIcon size={15} />
                Стоп
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onReset(timer.id)}
              className={cn("btn-primary", !timer.alarm && "flex-1")}
            >
              <ResetIcon size={15} />
              Повторить
            </button>
          </>
        ) : (
          <>
            {running ? (
              <button type="button" onClick={() => onPause(timer.id)} className="btn-primary flex-1">
                <PauseIcon size={15} />
                Пауза
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onResume(timer.id)}
                className="btn-primary flex-1"
              >
                <PlayIcon size={15} />
                Продолжить
              </button>
            )}

            <button
              type="button"
              onClick={() => onAddMinute(timer.id)}
              className="btn-secondary"
              aria-label="Добавить одну минуту"
              title="Добавить минуту"
            >
              <PlusIcon size={14} />1 мин
            </button>

            <button
              type="button"
              onClick={() => onReset(timer.id)}
              className="btn-ghost"
              aria-label="Сбросить таймер"
              title="Сбросить"
            >
              <ResetIcon size={16} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
