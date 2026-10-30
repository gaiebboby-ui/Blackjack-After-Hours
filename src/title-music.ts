import { volumePercent } from './preferences';

/** Decoded audio-buffer loop: no media-element restart gaps at the title seam. */
export class TitleMusic {
  private context?: AudioContext;
  private buffer?: Promise<AudioBuffer>;
  private source?: AudioBufferSourceNode;
  private gain?: GainNode;
  private enabled = false;
  private volume = .65;

  constructor(private readonly base: string) {}

  setVolume(percent: number) {
    this.volume = volumePercent(percent) / 100;
    if (this.context && this.gain) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, .025);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      void this.start().catch(() => {
        // Failed downloads can be retried with the sound button.
        this.buffer = undefined;
      });
    } else if (this.context && this.source && this.gain) {
      const { source, gain } = this;
      this.source = undefined;
      this.gain = undefined;
      gain.gain.cancelScheduledValues(this.context.currentTime);
      gain.gain.setTargetAtTime(0, this.context.currentTime, .045);
      source.stop(this.context.currentTime + .25);
    }
  }

  private async load(context: AudioContext) {
    // Vorbis has exact decoded loop length; MP3 is a compatibility fallback.
    for (const extension of ['ogg', 'mp3']) {
      try {
        const response = await fetch(`${this.base}game/audio/title-theme.${extension}`);
        if (!response.ok) continue;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (buffer.duration >= 59.99) return buffer;
      } catch { /* Try the next supported format. */ }
    }
    throw new Error('Title music unavailable');
  }

  private async start() {
    const context = this.context ??= new AudioContext();
    this.buffer ??= this.load(context);
    const [buffer] = await Promise.all([this.buffer, context.resume()]);
    if (!this.enabled || this.source || context.state !== 'running') return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.min(60, buffer.duration);
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume, context.currentTime + .12);
    source.connect(gain).connect(context.destination);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    this.source = source;
    this.gain = gain;
    source.start();
  }
}
