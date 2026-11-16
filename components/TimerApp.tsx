"use client";

import { useEffect, useRef, useState } from "react";
import { AddTimerForm } from "@/components/AddTimerForm";
import { AlarmIcon, ClockIcon } from "@/components/Icons";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimerCard } from "@/components/TimerCard";
import { clampMinutes, formatDuration } from "@/lib/format";
import { clearMelody, readMelody, saveMelody } from "@/lib/melodyStore";
import { alarmSound } from "@/lib/sound";
import { readJSON, readString, STORAGE, writeJSON, writeString } from "@/lib/storage";
import { restoreTimers } from "@/lib/timers";
import type { SoundModeKind, TimerItem, VolumeLevel } from "@/lib/types";
import { normalizeVolume } from "@/lib/types";

interface MelodyState {
  name: string;
  url: string;
}

const MAX_MELODY_SIZE = 20 * 1024 * 1024;

export default function TimerApp() {
  const [timers, setTimers] = useState<TimerItem[]>([]);
  // 0 при серверном рендере: Date.now() нельзя вычислять во время пререндера.
  const [now, setNow] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const [soundMode, setSoundMode] = useState<SoundModeKind>("default");
  const [volume, setVolume] = useState<VolumeLevel>(1);
  const [melody, setMelody] = useState<MelodyState | null>(null);
  const [melodyError, setMelodyError] = useState<string | null>(null);

  const [notifyEnabled, setNotifyEnabled] = useState(false);

  const melodyUrlRef = useRef<string | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const effectiveMode: SoundModeKind = soundMode === "custom" && melody ? "custom" : "default";
  const melodyUrl = melody?.url ?? null;
  const alarmKey = timers
    .filter((timer) => timer.status === "finished" && timer.alarm)
    .map((timer) => timer.id)
    .join("|");
  const hasAlarm = alarmKey.length > 0;

  /* ---------- восстановление состояния ---------- */

  useEffect(() => {
    const stored = readJSON<unknown>(STORAGE.timers);
    // Гидратация: состояние читается из localStorage только на клиенте.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setTimers(restoreTimers(stored));
    setNow(Date.now());

    const storedMode = readString(STORAGE.soundMode);
    if (storedMode === "custom" || storedMode === "default") setSoundMode(storedMode);

    const storedVolumeRaw = readString(STORAGE.volume);
    const storedVolume = normalizeVolume(storedVolumeRaw);
    setVolume(storedVolume);
    if (storedVolumeRaw !== null && storedVolumeRaw !== String(storedVolume)) {
      writeString(STORAGE.volume, String(storedVolume));
    }

    setNotifyEnabled(readString(STORAGE.notifications) === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    readMelody()
      .then((record) => {
        if (cancelled || !record) return;
        const url = URL.createObjectURL(record.blob);
        melodyUrlRef.current = url;
        setMelody({ name: record.name, url });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (melodyUrlRef.current) {
        URL.revokeObjectURL(melodyUrlRef.current);
        melodyUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (hydrated) writeJSON(STORAGE.timers, timers);
  }, [timers, hydrated]);

  /* ---------- тик и завершение ---------- */

  useEffect(() => {
    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);

      setTimers((previous) => {
        let changed = false;
        const next = previous.map((timer) => {
          if (timer.status === "running" && timer.endsAt !== null && timer.endsAt <= timestamp) {
            changed = true;
            return {
              ...timer,
              status: "finished" as const,
              remainingMs: 0,
              endsAt: null,
              alarm: true,
            };
          }
          return timer;
        });
        return changed ? next : previous;
      });
    };

    const interval = window.setInterval(tick, 200);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* ---------- звук ---------- */

  useEffect(() => {
    const unlock = () => alarmSound.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    alarmSound.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!hydrated) return;

    if (!hasAlarm) {
      alarmSound.stop();
      return;
    }

    alarmSound.start(
      effectiveMode === "custom" && melodyUrl
        ? { kind: "custom", url: melodyUrl }
        : { kind: "default" },
    );

    return () => alarmSound.stop();
  }, [hasAlarm, hydrated, effectiveMode, melodyUrl]);

  /* ---------- уведомления и заголовок ---------- */

  useEffect(() => {
    if (!hydrated) return;

    for (const timer of timers) {
      if (timer.status !== "finished" || !timer.alarm) continue;
      if (notifiedIdsRef.current.has(timer.id)) continue;
      notifiedIdsRef.current.add(timer.id);

      if (!notifyEnabled) continue;
      if (typeof window === "undefined" || !("Notification" in window)) continue;
      if (Notification.permission !== "granted") continue;

      try {
        new Notification("Время вышло", {
          body: `Таймер «${timer.name}» завершён`,
          tag: timer.id,
        });
      } catch {
        // ignore
      }
    }
  }, [timers, hydrated, notifyEnabled]);

  useEffect(() => {
    if (!hydrated) return;

    if (hasAlarm) {
      document.title = "🔔 Время вышло — Таймеры";
      return;
    }

    const nextTimer = timers
      .filter((timer) => timer.status === "running" && timer.endsAt !== null)
      .sort((a, b) => (a.endsAt ?? 0) - (b.endsAt ?? 0))[0];

    document.title =
      nextTimer?.endsAt != null
        ? `${formatDuration(nextTimer.endsAt - now)} · ${nextTimer.name}`
        : "Таймеры — обратный отсчёт";
  }, [timers, now, hydrated, hasAlarm]);

  /* ---------- действия с таймерами ---------- */

  function addTimer(rawName: string, minutes: number) {
    alarmSound.unlock();
    const timestamp = Date.now();
    const durationMs = clampMinutes(minutes) * 60_000;

    setTimers((previous) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `timer-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;

      const timer: TimerItem = {
        id,
        name: rawName || `Таймер ${previous.length + 1}`,
        durationMs,
        remainingMs: durationMs,
        endsAt: timestamp + durationMs,
        status: "running",
        alarm: false,
        createdAt: timestamp,
      };

      return [timer, ...previous];
    });

    setNow(timestamp);
  }

  function pauseTimer(id: string) {
    const timestamp = Date.now();
    setNow(timestamp);
    setTimers((previous) =>
      previous.map((timer) =>
        timer.id === id && timer.status === "running"
          ? {
              ...timer,
              status: "paused",
              remainingMs: Math.max(0, (timer.endsAt ?? timestamp) - timestamp),
              endsAt: null,
            }
          : timer,
      ),
    );
  }

  function resumeTimer(id: string) {
    const timestamp = Date.now();
    setNow(timestamp);
    setTimers((previous) =>
      previous.map((timer) =>
        timer.id === id && timer.status === "paused"
          ? { ...timer, status: "running", endsAt: timestamp + timer.remainingMs }
          : timer,
      ),
    );
  }

  function resetTimer(id: string) {
    const timestamp = Date.now();
    setNow(timestamp);
    setTimers((previous) =>
      previous.map((timer) =>
        timer.id === id
          ? {
              ...timer,
              status: "running",
              remainingMs: timer.durationMs,
              endsAt: timestamp + timer.durationMs,
              alarm: false,
            }
          : timer,
      ),
    );
  }

  function addMinute(id: string) {
    const boost = 60_000;
    setTimers((previous) =>
      previous.map((timer) => {
        if (timer.id !== id) return timer;

        if (timer.status === "running" && timer.endsAt !== null) {
          return {
            ...timer,
            durationMs: timer.durationMs + boost,
            endsAt: timer.endsAt + boost,
          };
        }

        if (timer.status === "paused") {
          return {
            ...timer,
            durationMs: timer.durationMs + boost,
            remainingMs: timer.remainingMs + boost,
          };
        }

        return timer;
      }),
    );
  }

  function silenceTimer(id: string) {
    setTimers((previous) =>
      previous.map((timer) => (timer.id === id ? { ...timer, alarm: false } : timer)),
    );
  }

  function deleteTimer(id: string) {
    notifiedIdsRef.current.delete(id);
    setTimers((previous) => previous.filter((timer) => timer.id !== id));
  }

  function clearFinished() {
    setTimers((previous) => previous.filter((timer) => timer.status !== "finished"));
  }

  /* ---------- звук: настройки ---------- */

  function changeSoundMode(mode: SoundModeKind) {
    if (mode === "custom" && !melody) return;
    setSoundMode(mode);
    writeString(STORAGE.soundMode, mode);
  }

  function changeVolume(level: VolumeLevel) {
    setVolume(level);
    writeString(STORAGE.volume, String(level));
    alarmSound.setVolume(level);
  }

  async function uploadMelody(file: File) {
    if (!file.type.startsWith("audio/")) {
      setMelodyError("Это не аудиофайл. Подойдёт MP3, WAV, OGG или M4A.");
      return;
    }
    if (file.size > MAX_MELODY_SIZE) {
      setMelodyError("Файл больше 20 МБ.");
      return;
    }

    setMelodyError(null);

    try {
      const record = await saveMelody(file);
      if (melodyUrlRef.current) URL.revokeObjectURL(melodyUrlRef.current);
      const url = URL.createObjectURL(record.blob);
      melodyUrlRef.current = url;
      setMelody({ name: record.name, url });
      setSoundMode("custom");
      writeString(STORAGE.soundMode, "custom");
      alarmSound.unlock();
    } catch {
      setMelodyError("Не удалось сохранить мелодию в браузере.");
    }
  }

  async function removeMelody() {
    try {
      await clearMelody();
    } catch {
      // ignore
    }

    if (melodyUrlRef.current) {
      URL.revokeObjectURL(melodyUrlRef.current);
      melodyUrlRef.current = null;
    }

    setMelody(null);
    setSoundMode("default");
    writeString(STORAGE.soundMode, "default");
  }

  function previewSound() {
    alarmSound.unlock();
    if (soundMode === "custom" && melody) {
      alarmSound.previewCustom(melody.url);
      return;
    }
    alarmSound.previewDefault();
  }

  function enableNotifications() {
    setNotifyEnabled(true);
    writeString(STORAGE.notifications, "1");
  }

  function disableNotifications() {
    setNotifyEnabled(false);
    writeString(STORAGE.notifications, "0");
  }

  const runningCount = timers.filter((timer) => timer.status === "running").length;
  const finishedIdleCount = timers.filter(
    (timer) => timer.status === "finished" && !timer.alarm,
  ).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:pt-9">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25">
            <ClockIcon size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Таймеры</h1>
            <p className="text-xs text-muted">Обратный отсчёт без лишнего</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-card/70 p-1 backdrop-blur">
          <NotificationToggle
            enabled={notifyEnabled}
            onEnable={enableNotifications}
            onDisable={disableNotifications}
          />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-10 pt-6 sm:pt-8">
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="lg:sticky lg:top-6">
            <AddTimerForm
              onAdd={addTimer}
              soundMode={soundMode}
              volume={volume}
              melodyName={melody?.name ?? null}
              melodyError={melodyError}
              onModeChange={changeSoundMode}
              onVolumeChange={changeVolume}
              onUpload={uploadMelody}
              onRemoveMelody={removeMelody}
              onPreview={previewSound}
            />
          </div>

          <section className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase text-muted">
                Таймеры
                {timers.length > 0 ? (
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold text-muted dark:bg-white/10">
                    {timers.length}
                  </span>
                ) : null}
              </h2>

              {finishedIdleCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFinished}
                  className="cursor-pointer text-xs font-medium text-muted transition hover:text-rose-500"
                >
                  Убрать завершённые
                </button>
              ) : null}
            </div>

            {!hydrated ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1].map((key) => (
                  <div key={key} className="card h-[214px] animate-pulse bg-card/50" />
                ))}
              </div>
            ) : timers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-card/40 px-6 py-16 text-center sm:py-24">
                <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <ClockIcon size={26} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Пока нет таймеров</h3>
                <p className="mt-1 max-w-xs text-sm text-muted">
                  Введите название, выберите минуты и нажмите «Добавить таймер». Таймеров может быть
                  сколько угодно.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {timers.map((timer) => (
                  <TimerCard
                    key={timer.id}
                    timer={timer}
                    now={now}
                    onPause={pauseTimer}
                    onResume={resumeTimer}
                    onReset={resetTimer}
                    onAddMinute={addMinute}
                    onSilence={silenceTimer}
                    onDelete={deleteTimer}
                  />
                ))}
              </div>
            )}

            {timers.length > 0 ? (
              <p className="mt-4 flex items-center gap-1.5 px-1 text-xs text-muted">
                <AlarmIcon size={13} />
                {runningCount > 0
                  ? `Идут сейчас: ${runningCount}. Таймеры работают и в фоновой вкладке.`
                  : "Все таймеры на паузе или завершены."}
              </p>
            ) : null}
          </section>
        </div>

        <div aria-live="polite" className="sr-only">
          {hasAlarm ? "Один или несколько таймеров завершены" : ""}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-8 text-center text-[11px] leading-relaxed text-muted/70">
        Звук включается после первого клика по странице — так требуют браузеры.
        <br />
        Настройки и таймеры сохраняются локально в этом браузере.
        <br />
        <a
          href="lite/"
          className="underline decoration-dotted underline-offset-2 transition hover:text-accent"
        >
          Облегчённая версия для старых устройств
        </a>
      </footer>
    </div>
  );
}
