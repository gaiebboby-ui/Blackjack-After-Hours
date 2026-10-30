import { volumePercent } from './preferences';

/** Stream the long table score instead of decoding fifteen minutes into memory. */
export class TableMusic {
  private audio?: HTMLAudioElement;
  private enabled = false;
  private pending?: Promise<void>;
  private volume = .65;

  constructor(private readonly base: string) {}

  setVolume(percent: number) {
    this.volume = volumePercent(percent) / 100;
    if (this.audio) this.audio.volume = this.volume;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) { this.audio?.pause(); return; }
    const audio = this.audio ??= this.createAudio();
    if (!audio.paused || this.pending) return;
    this.pending = audio.play().then(() => {
      if (!this.enabled) audio.pause();
    }).catch(() => {
      // Autoplay denial and interrupted loads can be retried on the next gesture.
    }).finally(() => { this.pending = undefined; });
  }

  private createAudio() {
    const audio = new Audio(`${this.base}game/audio/table-theme.mp3`);
    audio.preload = 'none';
    audio.loop = true;
    audio.volume = this.volume;
    return audio;
  }
}
