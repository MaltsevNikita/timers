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
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private volume = 1;
  private active = false;

  /**
   * Уровень громкости сигнала. Значения выше 1 работают только через
   * Web Audio (GainNode): обычный audio.volume ограничен единицей.
   */
  setVolume(volume: number): void {
    this.volume = volume > 0 ? volume : 1;

    if (this.gain) {
      this.gain.gain.value = this.volume;
    }
    if (this.audio) {
      // Если GainNode недоступен, громче 100 % обычным способом не сделать.
      this.audio.volume = this.gain ? 1 : Math.min(1, this.volume);
    }
  }

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
      this.audio = audio;
      this.routeThroughGain(audio);
      void audio.play().catch(() => {
        this.audio = null;
        this.disconnectNodes();
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
    this.disconnectNodes();
  }

  previewDefault(): void {
    this.unlock();
    this.playChime();
  }

  previewCustom(url: string): void {
    this.unlock();
    const audio = new Audio(url);
    const nodes = this.routeThroughGain(audio);
    void audio.play().catch(() => {});
    window.setTimeout(() => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (nodes) {
        try {
          nodes.source.disconnect();
          nodes.gain.disconnect();
        } catch {
          // ignore
        }
      }
    }, 7000);
  }

  /**
   * Направить <audio> через GainNode, чтобы громкость могла быть выше 100 %.
   * Возвращает узлы для последующего отключения либо null при недоступности
   * Web Audio (тогда остаётся audio.volume, ограниченный единицей).
   */
  private routeThroughGain(
    audio: HTMLAudioElement,
  ): { source: MediaElementAudioSourceNode; gain: GainNode } | null {
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) {
      audio.volume = Math.min(1, this.volume);
      return null;
    }

    try {
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = this.volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      audio.volume = 1;
      // Для зацикленного сигнала сохраняем узлы, чтобы менять громкость на лету.
      if (audio === this.audio) {
        this.source = source;
        this.gain = gain;
      }
      return { source, gain };
    } catch {
      audio.volume = Math.min(1, this.volume);
      return null;
    }
  }

  private disconnectNodes(): void {
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }
    if (this.gain) {
      try {
        this.gain.disconnect();
      } catch {
        // ignore
      }
      this.gain = null;
    }
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
    gain.gain.exponentialRampToValueAtTime(peak * this.volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }
}

export const alarmSound = new AlarmSound();
