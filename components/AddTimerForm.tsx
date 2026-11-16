"use client";

import { useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "@/components/Icons";
import { SoundSettings } from "@/components/SoundSettings";
import { cn } from "@/lib/cn";
import { clampMinutes, MAX_MINUTES, MIN_MINUTES } from "@/lib/format";
import type { SoundModeKind, VolumeLevel } from "@/lib/types";

const PRESETS = [1, 5, 10, 25, 45];

interface AddTimerFormProps {
  onAdd: (name: string, minutes: number) => void;
  soundMode: SoundModeKind;
  volume: VolumeLevel;
  melodyName: string | null;
  melodyError: string | null;
  onModeChange: (mode: SoundModeKind) => void;
  onVolumeChange: (volume: VolumeLevel) => void;
  onUpload: (file: File) => void;
  onRemoveMelody: () => void;
  onPreview: () => void;
}

export function AddTimerForm({
  onAdd,
  soundMode,
  volume,
  melodyName,
  melodyError,
  onModeChange,
  onVolumeChange,
  onUpload,
  onRemoveMelody,
  onPreview,
}: AddTimerFormProps) {
  const [name, setName] = useState("");
  const [minutesText, setMinutesText] = useState("5");
  const nameRef = useRef<HTMLInputElement>(null);

  const minutes = clampMinutes(Number.parseInt(minutesText || "0", 10) || MIN_MINUTES);

  function changeMinutes(next: number) {
    setMinutesText(String(clampMinutes(next)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAdd(name.trim(), minutes);
    setName("");
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Новый таймер</h2>

      <div className="mt-4">
        <label htmlFor="timer-name" className="mb-1.5 block text-xs font-medium text-muted">
          Название
        </label>
        <input
          id="timer-name"
          ref={nameRef}
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 60))}
          placeholder="Например, «Чай»"
          maxLength={60}
          autoComplete="off"
          className="field"
        />
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-xs font-medium text-muted">Время</span>
        <div className="flex items-center justify-between rounded-2xl border border-line bg-background/50 p-1.5">
          <button
            type="button"
            onClick={() => changeMinutes(minutes - 1)}
            disabled={minutes <= MIN_MINUTES}
            aria-label="Уменьшить на минуту"
            className="grid size-11 cursor-pointer place-items-center rounded-xl border border-line bg-card text-foreground transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent disabled:pointer-events-none disabled:opacity-40"
          >
            <MinusIcon size={18} />
          </button>

          <div className="flex items-baseline justify-center gap-1.5">
            <input
              value={minutesText}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
                setMinutesText(digits);
              }}
              onBlur={() => setMinutesText(String(minutes))}
              onFocus={(event) => event.currentTarget.select()}
              inputMode="numeric"
              aria-label="Количество минут"
              className="w-16 rounded-lg bg-transparent text-center font-mono text-3xl font-semibold tabular-nums outline-none focus:ring-2 focus:ring-accent/30"
            />
            <span className="text-sm text-muted">мин</span>
          </div>

          <button
            type="button"
            onClick={() => changeMinutes(minutes + 1)}
            disabled={minutes >= MAX_MINUTES}
            aria-label="Увеличить на минуту"
            className="grid size-11 cursor-pointer place-items-center rounded-xl border border-line bg-card text-foreground transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent disabled:pointer-events-none disabled:opacity-40"
          >
            <PlusIcon size={18} />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => changeMinutes(preset)}
              className={cn(
                "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                minutes === preset
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line text-muted hover:border-accent/30 hover:text-foreground",
              )}
            >
              {preset} мин
            </button>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-accent mt-5 h-12 w-full rounded-2xl text-[15px]">
        <PlusIcon size={18} />
        Добавить таймер
      </button>

      <SoundSettings
        mode={soundMode}
        volume={volume}
        melodyName={melodyName}
        error={melodyError}
        onModeChange={onModeChange}
        onVolumeChange={onVolumeChange}
        onUpload={onUpload}
        onRemove={onRemoveMelody}
        onPreview={onPreview}
      />
    </form>
  );
}
