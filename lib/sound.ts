export type SoundMode = { kind: "default" } | { kind: "custom"; url: string };

type AudioContextCtor = typeof AudioContext;

const CHIME_INTERVAL_MS = 2600;

/**
 * Единый контроллер сигнала: синтезированный «динь-дон» через Web Audio
 * либо зацикленная пользовательская мелодия через <audio>.
 */
class AlarmSound {
  private ctx: AudioContext | null = null;
  private loopId: number | null = null;
  private audio: HTMLAudioElement | null = null;
  private active = false;

  /** Разблокировать аудио внутри пользовательского жеста. */
  unlock(): void {
    if (typeof window === "undefined") return;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;

    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }

    // Тихий буфер помогает разблокировать звук в iOS Safari.
    try {
      const buffer = this.ctx.createBuffer(1, 1, 22_050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch {
      // ignore
    }
  }

  start(mode: SoundMode): void {
    if (typeof window === "undefined") return;
    this.stop();
    this.active = true;

    if (mode.kind === "custom") {
      const audio = new Audio(mode.url);
      audio.loop = true;
      audio.volume = 0.9;
      this.audio = audio;
      void audio.play().catch(() => {
        this.audio = null;
        if (this.active) this.startChimeLoop();
      });
      return;
    }

    this.startChimeLoop();
  }

  stop(): void {
    this.active = false;
    this.stopChimeLoop();

    if (this.audio) {
      const audio = this.audio;
      this.audio = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  }

  previewDefault(): void {
    this.unlock();
    this.playChime();
  }

  previewCustom(url: string): void {
    const audio = new Audio(url);
    audio.volume = 0.9;
    void audio.play().catch(() => {});
    window.setTimeout(() => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }, 7000);
  }

  private startChimeLoop(): void {
    this.stopChimeLoop();
    this.unlock();
    this.playChime();
    this.loopId = window.setInterval(() => {
      if (!this.active) {
        this.stopChimeLoop();
        return;
      }
      this.playChime();
    }, CHIME_INTERVAL_MS);
  }

  private stopChimeLoop(): void {
    if (this.loopId !== null) {
      window.clearInterval(this.loopId);
      this.loopId = null;
    }
  }

  private playChime(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    const start = ctx.currentTime + 0.03;
    const notes: Array<[frequency: number, offset: number]> = [
      [440, 0],
      [880, 0.02],
      [1174.66, 0.2],
      [1567.98, 0.38],
    ];

    for (const [frequency, offset] of notes) {
      this.playTone(frequency, start + offset, 0.6, frequency === 440 ? 0.14 : 0.2);
    }
  }

  private playTone(frequency: number, start: number, duration: number, peak: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }
}

export const alarmSound = new AlarmSound();
