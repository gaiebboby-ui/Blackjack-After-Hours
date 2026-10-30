import type { GameState, Phase } from './engine';
export const DEALER_FRAME_COUNT = 16;

/** Preserve the displayed mixture when a new pose interrupts an unfinished tween. */
export class DealerPoseBlend {
  private target = 0;
  private started = 0;
  private duration = 80;
  private from: number[] = Array.from({length:DEALER_FRAME_COUNT}, (_, i) => i === 0 ? 1 : 0);

  sample(frame: number, time: number, reduced = false, transitionMs?: number): number[] {
    const weightsAt = () => {
      const p = Math.max(0, Math.min(1, (time - this.started) / this.duration));
      const t = p * p * (3 - 2 * p);
      return this.from.map((weight, i) => weight * (1 - t) + (i === this.target ? t : 0));
    };
    if (reduced) {
      this.target = frame; this.from = this.from.map((_, i) => i === frame ? 1 : 0); this.started = time;
      return [...this.from];
    }
    if (frame !== this.target) {
      this.from = weightsAt();
      const blink = (index: number) => [1,2,3,9,10,11].includes(index);
      this.duration = transitionMs ?? (blink(frame) || blink(this.target) ? 24 : 50);
      this.target = frame; this.started = time;
    }
    return weightsAt();
  }
}

/** Timing is relative to each event, not a global animation loop. */
export class DealerAnimation {
  private phase?: Phase;
  private round = -1;
  private reaction = 0;
  private reactionStart = -Infinity;
  private blinkStart = -Infinity;
  private nextBlink = 3600;
  private blinkCount = 0;

  update(state: Pick<GameState, 'phase' | 'round' | 'delta'>, time: number) {
    if (state.phase === this.phase && state.round === this.round) return;
    this.phase = state.phase; this.round = state.round;
    this.reactionStart = time;
    // Expressions belong to the dealer: the player's win disappoints her.
    this.reaction = state.phase === 'result' ? state.delta > 0 ? 8 : state.delta < 0 ? 7 : 0 : 0;
    this.nextBlink = time + (this.reaction ? 4600 : 2600);
    this.blinkStart = -Infinity;
  }

  sample(time: number, reduced = false): {frame:number;breathe:number;blendMs?:number} {
    const reactionAge = time - this.reactionStart;
    if (reduced) return { frame: reactionAge<3650 ? this.reaction : 0, breathe: 0 };
    // Show the result immediately instead of hiding it behind a generic talking loop.
    // Pleased frames carry the dealer's winning smirk; losing frames look unimpressed.
    if (this.reaction && reactionAge >= 0 && reactionAge < 3970) {
      const half=this.reaction===7?14:15;
      const frame=reactionAge<80?0:reactionAge<240?half:reactionAge<3400?this.reaction:reactionAge<3650?half:0;
      return {frame,breathe:0,blendMs:reactionAge<3400?(this.reaction===7?220:150):320};
    }
    if (time >= this.nextBlink) {
      this.blinkStart = time;
      this.nextBlink = time + [4000, 5100, 3500, 4700][this.blinkCount++ % 4];
    }
    const blink = time - this.blinkStart;
    const frame = blink < 25 ? 9 : blink < 55 ? 1 : blink < 80 ? 10 : blink < 130 ? 2 :
      blink < 155 ? 11 : blink < 185 ? 3 : blink < 210 ? 9 :
      0;
    return { frame, breathe: Math.sin(time / 1500) * .7 };
  }
}
