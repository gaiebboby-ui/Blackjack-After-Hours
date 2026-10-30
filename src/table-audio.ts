import { volumePercent } from './preferences';

export type TableCue = 'card' | 'flip' | 'chip' | 'win';

/** Quiet tactile cues, with one shared noise buffer and a bounded output bus. */
export class TableAudio {
  private context?: AudioContext;
  private output?: GainNode;
  private paper?: AudioBuffer;
  private enabled = false;
  private volume = .65;

  setVolume(percent: number) {
    this.volume = volumePercent(percent) / 100;
    if (this.context && this.output) {
      this.output.gain.cancelScheduledValues(this.context.currentTime);
      this.output.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, .012);
    }
  }

  unlock(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      if (this.context && this.output) {
        this.output.gain.cancelScheduledValues(this.context.currentTime);
        this.output.gain.setTargetAtTime(0, this.context.currentTime, .012);
      }
      return;
    }
    try {
      if (!this.context) {
        const context = new AudioContext();
        this.context = context;
        this.output = context.createGain();
        this.output.gain.value = this.volume;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 12;
        limiter.ratio.value = 4;
        this.output.connect(limiter).connect(context.destination);
        this.paper = context.createBuffer(1, Math.ceil(context.sampleRate * .24), context.sampleRate);
        const samples = this.paper.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = .55 * previous + .45 * (Math.random() * 2 - 1);
          samples[i] = previous;
        }
      }
      this.output!.gain.setTargetAtTime(this.volume, this.context.currentTime, .012);
      void this.context.resume().catch(() => {});
    } catch { /* Audio is optional, including on devices without Web Audio. */ }
  }

  play(kind: TableCue) {
    const context = this.context;
    if (!this.enabled || !context || !this.output || context.state !== 'running') return;
    const time = context.currentTime;
    if (kind === 'card' || kind === 'flip') {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      source.buffer = this.paper!;
      source.playbackRate.value = kind === 'flip' ? 1.2 : .95;
      filter.type = 'bandpass';
      filter.frequency.value = kind === 'flip' ? 1800 : 1100;
      filter.Q.value = .65;
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(.10, time + .009);
      envelope.gain.exponentialRampToValueAtTime(.0001, time + .105);
      source.connect(filter).connect(envelope).connect(this.output);
      source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
      source.start(time);
      source.stop(time + .13);
      this.tone(kind === 'flip' ? 190 : 140, time, .045, .018);
    } else if (kind === 'chip') {
      this.tone(1180, time, .075, .022);
      this.tone(1730, time + .012, .055, .011);
      this.tone(245, time, .035, .022);
    } else {
      // A brief warm sixth/ninth colour, with no repeated celebratory fanfare.
      [440, 523.25, 659.25, 987.77].forEach((frequency, i) => {
        this.tone(frequency, time + i * .035, .42, i === 3 ? .008 : .016);
      });
    }
  }

  private tone(frequency: number, time: number, duration: number, volume: number) {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + .004);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope).connect(this.output!);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + duration + .02);
  }
}
