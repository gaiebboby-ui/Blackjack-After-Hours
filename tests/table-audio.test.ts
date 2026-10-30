import { afterEach, expect, it, vi } from 'vitest';
import { TableAudio } from '../src/table-audio';

afterEach(() => vi.unstubAllGlobals());

it('keeps SFX level independent of master mute, including before audio unlock', () => {
  const output = { gain: { value: -1, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis() };
  class Context {
    currentTime = 1;
    destination = {};
    createGain = () => output;
    createDynamicsCompressor = () => ({ threshold: {}, knee: {}, ratio: {}, connect: vi.fn() });
    createBuffer = () => ({ getChannelData: () => new Float32Array(1) });
    sampleRate = 32000;
    resume = vi.fn().mockResolvedValue(undefined);
  }
  vi.stubGlobal('AudioContext', Context);
  const audio = new TableAudio();
  audio.setVolume(40);
  audio.unlock(true);
  expect(output.gain.value).toBe(.4);
  expect(output.gain.setTargetAtTime).toHaveBeenLastCalledWith(.4, 1, .012);
  audio.setVolume(0);
  expect(output.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, .012);
  audio.unlock(false);
  audio.setVolume(80);
  expect(output.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, .012);
  audio.unlock(true);
  expect(output.gain.setTargetAtTime).toHaveBeenLastCalledWith(.8, 1, .012);
});
