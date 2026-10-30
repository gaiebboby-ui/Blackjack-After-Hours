import { afterEach, describe, expect, it, vi } from 'vitest';
import { TitleMusic } from '../src/title-music';

function setup() {
  const sources: ReturnType<typeof source>[] = [];
  function source() {
    return { buffer: undefined, loop: false, loopStart: -1, loopEnd: -1,
      connect: vi.fn().mockReturnThis(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: undefined };
  }
  const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
  const decode = vi.fn().mockResolvedValue({ duration: 60 });
  class Context {
    currentTime = 1;
    state = 'running';
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    decodeAudioData = decode;
    createGain = () => gain;
    createBufferSource = () => { const node = source(); sources.push(node); return node; };
  }
  vi.stubGlobal('AudioContext', Context);
  const fetch = vi.fn().mockResolvedValue({ok: true, arrayBuffer: async () => new ArrayBuffer(1)});
  vi.stubGlobal('fetch', fetch);
  return { music: new TitleMusic('/blackjack/'), sources, gain, fetch, decode };
}

afterEach(() => vi.unstubAllGlobals());

describe('title theme playback', () => {
  it('uses the latest volume after loading and adjusts a playing loop without restarting', async () => {
    const { music, sources, gain } = setup();
    music.setVolume(30);
    music.setEnabled(true);
    music.setVolume(20);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.2, 1.12);
    music.setVolume(0);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, .025);
    music.setVolume(80);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(.8, 1, .025);
    expect(sources).toHaveLength(1);
    expect(sources[0].stop).not.toHaveBeenCalled();
  });

  it('stays silent and makes no download when disabled', () => {
    const { music, fetch, sources } = setup();
    music.setEnabled(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(sources).toHaveLength(0);
  });

  it('starts one exact 60-second buffer loop even after repeated gestures', async () => {
    const { music, fetch, sources } = setup();
    music.setEnabled(true); music.setEnabled(true);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/blackjack/game/audio/title-theme.ogg');
    expect(sources[0]).toMatchObject({loop: true, loopStart: 0, loopEnd: 60});
    expect(sources[0].start).toHaveBeenCalledOnce();
  });

  it('does not start late if the user enters the game while audio is downloading', async () => {
    const { music, fetch, sources } = setup();
    let finish!: (value: unknown) => void;
    fetch.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    music.setEnabled(true);
    music.setEnabled(false);
    finish({ok: true, arrayBuffer: async () => new ArrayBuffer(1)});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sources).toHaveLength(0);
  });

  it('fades out on mute or leaving the splash, then can restart from cached audio', async () => {
    const { music, sources, gain, fetch } = setup();
    music.setEnabled(true);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    music.setEnabled(false);
    expect(gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 1, .045);
    expect(sources[0].stop).toHaveBeenCalledWith(1.25);
    music.setEnabled(true);
    await vi.waitFor(() => expect(sources).toHaveLength(2));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to MP3 when Vorbis cannot be decoded', async () => {
    const { music, decode, fetch, sources } = setup();
    decode.mockRejectedValueOnce(new Error('unsupported format'));
    music.setEnabled(true);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    expect(fetch).toHaveBeenLastCalledWith('/blackjack/game/audio/title-theme.mp3');
  });

  it('handles unavailable audio and allows a subsequent retry', async () => {
    const { music, fetch, sources } = setup();
    fetch.mockResolvedValueOnce({ok: false}).mockResolvedValueOnce({ok: false});
    music.setEnabled(true);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sources).toHaveLength(0);
    music.setEnabled(false); music.setEnabled(true);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
  });
});
