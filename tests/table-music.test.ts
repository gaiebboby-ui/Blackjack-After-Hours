import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableMusic } from '../src/table-music';

function setup() {
  const audio = { paused: true, volume: 1, loop: false, preload: '',
    play: vi.fn().mockImplementation(async () => { audio.paused = false; }),
    pause: vi.fn().mockImplementation(() => { audio.paused = true; }), currentTime: 0 };
  const Audio = vi.fn(function () { return audio; });
  vi.stubGlobal('Audio', Audio);
  return { music: new TableMusic('/blackjack/'), audio, Audio };
}
afterEach(() => vi.unstubAllGlobals());

describe('table soundtrack', () => {
  it('downloads nothing until enabled and streams a looping score', async () => {
    const {music, audio, Audio} = setup();
    music.setEnabled(false);
    expect(Audio).not.toHaveBeenCalled();
    music.setVolume(30); music.setEnabled(true);
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledOnce());
    expect(Audio).toHaveBeenCalledWith('/blackjack/game/audio/table-theme.mp3');
    expect(audio).toMatchObject({loop: true, volume: .3, preload: 'none'});
  });
  it('pauses and resumes without losing the current position or creating another player', async () => {
    const {music, audio, Audio} = setup();
    music.setEnabled(true);
    await vi.waitFor(() => expect(audio.paused).toBe(false));
    await new Promise(resolve => setTimeout(resolve, 0));
    audio.currentTime = 217;
    music.setEnabled(false); expect(audio.paused).toBe(true);
    music.setVolume(0); expect(audio.volume).toBe(0);
    music.setEnabled(true);
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(audio.currentTime).toBe(217); expect(Audio).toHaveBeenCalledOnce();
  });
  it('stays paused when mute occurs while play is pending', async () => {
    const {music, audio} = setup();
    let finish!: () => void;
    audio.play.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    music.setEnabled(true); music.setEnabled(false); finish();
    await vi.waitFor(() => expect(audio.pause).toHaveBeenCalledTimes(2));
    expect(audio.paused).toBe(true);
  });
  it('retries rejected autoplay on a later user gesture', async () => {
    const {music, audio} = setup();
    audio.play.mockRejectedValueOnce(new Error('autoplay denied'));
    music.setEnabled(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    music.setEnabled(true);
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
  });
});
