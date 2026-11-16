"use client";

import { useRef } from "react";
import { MusicIcon, PlayIcon, UploadIcon, VolumeIcon, XIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";
import type { SoundModeKind, VolumeLevel } from "@/lib/types";
import { VOLUME_LEVELS } from "@/lib/types";

interface SoundSettingsProps {
  mode: SoundModeKind;
  volume: VolumeLevel;
  melodyName: string | null;
  error: string | null;
  onModeChange: (mode: SoundModeKind) => void;
  onVolumeChange: (volume: VolumeLevel) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
}

export function SoundSettings({
  mode,
  volume,
  melodyName,
  error,
  onModeChange,
  onVolumeChange,
  onUpload,
  onRemove,
  onPreview,
}: SoundSettingsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Звук сигнала</span>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium text-muted transition hover:text-accent"
        >
          <PlayIcon size={13} />
          Прослушать
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-foreground/5 p-1 dark:bg-white/10">
        <button
          type="button"
          onClick={() => onModeChange("default")}
          aria-pressed={mode === "default"}
          className={cn(
            "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition",
            mode === "default"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted hover:text-foreground",
          )}
        >
          <VolumeIcon size={15} />
          Стандартный
        </button>
        <button
          type="button"
          onClick={() => onModeChange("custom")}
          disabled={!melodyName}
          title={melodyName ? undefined : "Сначала загрузите мелодию"}
          aria-pressed={mode === "custom"}
          className={cn(
            "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
            mode === "custom"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted hover:text-foreground",
          )}
        >
          <MusicIcon size={15} />
          Своя мелодия
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Громкость</span>
          <span className="text-xs font-semibold text-accent tabular-nums">
            {Math.round(volume * 100)} %
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-foreground/5 p-1 dark:bg-white/10">
          {VOLUME_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onVolumeChange(level)}
              aria-pressed={volume === level}
              className={cn(
                "h-8 cursor-pointer rounded-xl text-xs font-medium tabular-nums transition",
                volume === level
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {Math.round(level * 100)} %
            </button>
          ))}
        </div>
      </div>

      {melodyName ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-background/50 px-3 py-2">
          <MusicIcon size={15} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted" title={melodyName}>
            {melodyName}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Удалить мелодию"
            title="Удалить мелодию"
            className="grid size-6 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
          >
            <XIcon size={14} />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-accent"
      >
        <UploadIcon size={15} />
        {melodyName ? "Заменить мелодию" : "Загрузить мелодию"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />

      {error ? <p className="mt-2 text-xs text-rose-500">{error}</p> : null}

      <p className="mt-2 text-[11px] leading-relaxed text-muted/80">
        MP3, WAV, OGG или M4A до 20 МБ. Файл хранится только в этом браузере. Громкость выше
        100 % усиливает сигнал через Web Audio.
      </p>
    </div>
  );
}
