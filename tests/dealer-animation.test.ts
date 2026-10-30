import { describe, expect, it } from 'vitest';
import { DealerAnimation, DealerPoseBlend, DEALER_FRAME_COUNT } from '../src/dealer-animation';
const onlyPose = (frame: number) => Array.from({length: DEALER_FRAME_COUNT}, (_, i) => i === frame ? 1 : 0);

describe('continuous dealer pose blending', () => {
  it('keeps the displayed mixture when a phrase interrupts a transition', () => {
    const blend = new DealerPoseBlend();
    blend.sample(5, 0);
    const before = blend.sample(5, 45);
    const interrupted = blend.sample(2, 45);
    expect(interrupted).toEqual(before);
    const after = blend.sample(2, 65);
    expect(after[2]).toBeGreaterThan(0);
    expect(after[5]).toBeGreaterThan(0);
    expect(after.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
    expect(blend.sample(2, 100)).toEqual(onlyPose(2));
  });
  it('returns from a held expression gradually instead of snapping',()=>{
    const blend=new DealerPoseBlend();
    blend.sample(8,0,false,150);expect(blend.sample(8,150)).toEqual(onlyPose(8));
    expect(blend.sample(0,3400,false,320)).toEqual(onlyPose(8));
    expect(blend.sample(0,3560)[0]).toBeCloseTo(.5);
    expect(blend.sample(0,3720)).toEqual(onlyPose(0));
  });
  it('has the same intermediate pose regardless of render cadence', () => {
    const slow = new DealerPoseBlend(), fast = new DealerPoseBlend();
    slow.sample(4, 0); fast.sample(4, 0);
    for (let time = 10; time < 70; time += 10) fast.sample(4, time);
    expect(slow.sample(4, 70)).toEqual(fast.sample(4, 70));
    expect(slow.sample(8, 71, true)).toEqual(onlyPose(8));
  });
});

describe('dealer animation timing', () => {
  it('does not restart a phrase on every card or resize', () => {
    const animation = new DealerAnimation();
    const state = { phase: 'dealing' as const, round: 1, delta: 0 };
    animation.update(state, 0);
    animation.update(state, 600);
    expect(animation.sample(1000).frame).toBe(0);
  });
  it('reacts relative to the result event and returns to idle once', () => {
    const animation = new DealerAnimation();
    animation.update({ phase: 'result', round: 1, delta: 100 }, 10000);
    expect(animation.sample(10600).frame).toBe(8);
    animation.sample(13300); // The expression is winding down.
    expect(animation.sample(14000).frame).toBe(0);
    animation.sample(14600); // A blink may happen after the emotion has finished.
    expect(animation.sample(15000).frame).toBe(0);
  });
  it('plays a full close-and-reopen blink between long pauses', () => {
    const animation = new DealerAnimation();
    animation.update({ phase: 'player', round: 1, delta: 0 }, 0);
    expect(animation.sample(2600).frame).toBe(9);
    expect(animation.sample(2630).frame).toBe(1);
    expect(animation.sample(2660).frame).toBe(10);
    expect(animation.sample(2700).frame).toBe(2);
    expect(animation.sample(2740).frame).toBe(11);
    expect(animation.sample(2770).frame).toBe(3);
    expect(animation.sample(2800).frame).toBe(9);
    expect(animation.sample(2830).frame).toBe(0);
    expect(animation.sample(5000).frame).toBe(0);
  });
  it('keeps a static expression with no breathing under reduced motion', () => {
    const animation = new DealerAnimation();
    animation.update({ phase: 'result', round: 1, delta: -100 }, 0);
    expect(animation.sample(180, true)).toEqual({ frame: 7, breathe: 0 });
    expect(animation.sample(3400, true)).toEqual({ frame: 7, breathe: 0 });
    expect(animation.sample(4100,true)).toEqual({frame:0,breathe:0});
  });
  it.each([{delta:100,half:15,full:8},{delta:-100,half:14,full:7}])('gives the dealer a distinct reaction to player delta $delta', ({delta,half,full}) => {
    const animation = new DealerAnimation();
    const state = {phase:'result' as const,round:1,delta};
    animation.update(state,10000);
    expect(animation.sample(10200).frame).toBe(half);
    expect(animation.sample(10600).frame).toBe(full);
    animation.update(state,11000); // Re-render must not replay or delay the emotion.
    expect(animation.sample(11200).frame).toBe(full);
    expect(animation.sample(11900).frame).toBe(full);
    expect(animation.sample(12600).frame).toBe(full);
    expect(animation.sample(12800).frame).toBe(full);
    expect(animation.sample(12800,true).frame).toBe(full);
    expect(animation.sample(13300).frame).toBe(full);
    expect(animation.sample(13450).frame).toBe(half);
    expect(animation.sample(13700).frame).toBe(0);
    expect(animation.sample(14000).frame).toBe(0);
    expect(animation.sample(14000,true).frame).toBe(0);
    animation.update({phase:'dealing',round:2,delta:0},14100);
    expect(animation.sample(14100,true).frame).toBe(0);
  });
  it('keeps tied or net-zero split results neutral', () => {
    const animation = new DealerAnimation();
    animation.update({phase:'result',round:1,delta:0},0);
    expect(animation.sample(1200).frame).toBe(0);
    expect(animation.sample(1200,true).frame).toBe(0);
  });
});
