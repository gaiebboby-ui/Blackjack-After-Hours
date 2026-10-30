"""A fifteen-minute, circularly rendered development of Midnight Circuit.

Run: python scripts/compose-midnight-extended.py
Shares the original demo's instrument synthesis, but has its own long-form score.
"""
from pathlib import Path
import importlib.util
import json
import math
import shutil
import struct
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SPEC = importlib.util.spec_from_file_location('casino', Path(__file__).with_name('compose-casino.py'))
CASINO = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CASINO)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'music-demos' / 'midnight-extended'
SLUG = 'midnight-circuit-long-orbit'
SR = CASINO.SR
BARS = 384
BEATS = BARS * 4
SECONDS = 900
SPB = SECONDS / BEATS
BPM = 60 / SPB
PPQ = CASINO.PPQ
CHAPTERS = ['Glass Lobby', 'Quiet Signals', 'Neon Tide', 'Velvet Return',
            'Afterimage', 'Chrome Alley', 'Low Lights', 'Blue Current',
            'Neon Reprise', 'Wire Garden', 'Home Lights', 'Orbital Return']
MINOR = [(0, [0, 3, 7, 10, 14]), (5, [0, 3, 7, 10, 14]),
         (2, [0, 3, 6, 10]), (7, [0, 4, 7, 10, 13]),
         (0, [0, 3, 7, 10, 14]), (8, [0, 4, 7, 11, 14]),
         (2, [0, 3, 6, 10]), (7, [0, 4, 7, 10, 13])]
RELATIVE = [(3, [0, 4, 7, 11, 14]), (8, [0, 4, 7, 11, 14]),
            (5, [0, 3, 7, 10, 14]), (10, [0, 4, 7, 10, 14]),
            (3, [0, 4, 7, 11, 14]), (0, [0, 3, 7, 10, 14]),
            (2, [0, 3, 6, 10]), (7, [0, 4, 7, 10, 13])]
COLOUR = [(0, [0, 3, 7, 10, 14]), (10, [0, 4, 7, 10, 14]),
          (8, [0, 4, 7, 11, 14]), (5, [0, 3, 7, 10, 14]),
          (0, [0, 3, 7, 10, 14]), (5, [0, 3, 7, 10, 14]),
          (2, [0, 3, 6, 10]), (7, [0, 4, 7, 10, 13])]
ELECTRONIC_CENTRES = [72, 136, 216, 280, 312]


def smooth(x):
    x = np.clip(x, 0, 1)
    return float(x * x * (3 - 2 * x))


def swell(bar, centre, hold=2, ramp=8):
    distance = abs((bar - centre + BARS / 2) % BARS - BARS / 2)
    return 1 - smooth((distance - hold) / ramp)


def electronic_at(bar):
    return max(swell(bar, centre) for centre in ELECTRONIC_CENTRES)


def harmony(bar):
    bar %= BARS
    chapter = bar // 32
    cycle = (bar % 32) // 8
    # Every eight-bar phrase returns through B half-diminished / E7 to A minor.
    # Relative-major excursions happen in the middle of a chapter, never at the seam.
    progressions = [MINOR, RELATIVE if chapter % 3 != 0 else COLOUR, COLOUR, MINOR]
    if chapter in (0, 11):
        progressions = [MINOR, MINOR, COLOUR, MINOR]
    offset, intervals = progressions[cycle][bar % 8]
    return 45 + offset, intervals


def voicings():
    result = []
    previous = np.array([60, 64, 67, 71])
    # Warm-up one complete orbit makes voice-leading at the boundary deterministic.
    for bar in range(BARS * 2):
        root, intervals = harmony(bar)
        tones = intervals[1:] if len(intervals) == 5 else intervals
        pcs = [(root + n) % 12 for n in tones]
        candidates = []
        for octave in (48, 60):
            base = sorted(octave + p for p in pcs)
            for inversion in range(len(base)):
                candidate = np.array(sorted(base[inversion:] + [p + 12 for p in base[:inversion]]))
                if min(candidate) >= 55 and max(candidate) <= 81:
                    candidates.append(candidate)
        chosen = min(candidates, key=lambda c: float(np.abs(c - previous).sum()) + abs(float(c.mean()) - 66) * .3)
        previous = chosen
        if bar >= BARS:
            result.append(chosen.tolist())
    return result


def compose():
    rng = np.random.default_rng(3102026)
    notes = []
    chords = voicings()

    def add(track, beat, duration, pitch, velocity):
        if velocity < 2:
            return
        velocity = int(np.clip(round(velocity + rng.uniform(-1.8, 1.8)), 1, 100))
        assert 0 <= beat < BEATS and beat + duration <= BEATS and 0 <= pitch < 128
        notes.append((track, beat, duration, int(pitch), velocity))

    motifs = [[1, 0, 2, 1, 0], [1, 0, 2, 3, 1], [2, 1, 0, 1, 2], [1, 0, 2, 1, 0]]
    for bar in range(BARS):
        base = bar * 4
        root, intervals = harmony(bar)
        chord = chords[bar]
        e = electronic_at(bar + .5)
        rock = swell(bar + .5, 176, hold=4, ramp=8) * .65
        macro = .5 - .5 * math.cos(2 * math.pi * bar / BARS)
        # The same two comping gestures stay underneath the changing texture.
        for at, duration, strength in [(0, 1.35, 1), (2.5, .95, .86)]:
            for pitch in chord:
                add(0, base + at, duration, pitch, (47 + macro * 3) * strength)
        # Stable quarter-note foundation; offbeat bass gradually adds pulse.
        nextroot, _ = harmony(bar + 1)
        approach = nextroot - 13
        bass = root - 12
        while approach - bass > 7:
            approach -= 12
        while bass - approach > 7:
            approach += 12
        for step, pitch in enumerate([bass, bass + 7, bass + intervals[1], approach]):
            add(1, base + step, .77 - e * .13, pitch, 56 + (step % 2 == 0) * 5)
            add(1, base + step + .5, .27, bass + (12 if step == 3 else 0), e * 35)
        # Pads already exist in the quiet passages: no new block of sound on entry.
        for pitch in chord[:3]:
            add(4, base, 3.7, pitch, 23 + e * 8 + macro * 2)
        for at in (0, 2):
            add(7, base + at, .15, 36, 46 + e * 6)
        for at in (1, 3):
            add(7, base + at, .15, 36, e * 34)
            add(7, base + at, .14, 37, 36 * (1 - .55 * e))
            add(7, base + at, .14, 38, e * 38 + rock * 21)
        for step in range(8):
            add(7, base + step * .5, .08, 51, (28 + (step % 2 == 0) * 4) * (1 - e * .4))
            add(7, base + step * .5, .08, 42, e * (24 + (step % 2 == 0) * 5))
        # A quiet guitar pulse rounds into a brief boogie instead of a hard style cut.
        guitar = 9 + rock * 42 + e * 4
        for at in (0, 1, 2, 3):
            for pitch in (root + 12, root + 19 + (2 if at % 2 and rock > .1 else 0)):
                add(3, base + at, .36, pitch, guitar)
        # Original Midnight Circuit motif, answered and varied over 32-bar chapters.
        phrase = bar % 8
        if bar % 2 == 0:
            motif = motifs[(bar // 32) % len(motifs)]
            if bar < 32 or bar >= 352:
                motif = motifs[0]
            rhythm = [(.5, .38), (1.5, .38), (2, .65), (3, .38), (3.5, .32)]
            if phrase in (0, 4):
                rhythm = rhythm[:3]
            for step, (at, duration) in enumerate(rhythm):
                pitch = root + 24 + intervals[motif[step] % len(intervals)]
                while pitch > 85:
                    pitch -= 12
                add(2, base + at, duration, pitch, 53 - e * 15)
                add(5, base + at, duration + .05, pitch, e * 31)
        # Sparse answer phrases in the interior provide development and breathing room.
        if phrase == 5 and 32 <= bar < 352 and (bar // 8) % 3 == 1:
            for step, degree in enumerate([2, 1, 0]):
                add(2, base + .5 + step * .75, .45, root + 24 + intervals[degree], 34)
        # Arpeggio volume rises through a complete phrase and recedes through the next.
        for step in range(16):
            at = bar + step / 16
            amount = electronic_at(at)
            degree = [0, 1, 2, 3, 2, 1, 2, 1][step % 8] % len(intervals)
            add(6, base + step * .25, .18, root + 24 + intervals[degree], amount * (31 + (step % 4 == 0) * 5))
        # Two deliberately brief ascending/descending synth flourishes, inside a swell.
        if bar in (279, 311):
            for step, degree in enumerate([0, 1, 2, 3, 2, 1, 2, 3]):
                add(5, base + 2 + step * .25, .17, root + 24 + intervals[degree], 29)
    return notes


def write_midi(file, notes):
    meta = CASINO.meta
    tempo = round(SPB * 1_000_000)
    conductor = [(0, 0, meta(3, b'Midnight Circuit - Long Orbit')),
                 (0, 0, meta(0x51, tempo.to_bytes(3, 'big'))),
                 (0, 0, meta(0x58, bytes([4, 2, 24, 8]))),
                 (0, 1, meta(6, b'loopStart')),
                 (BEATS * PPQ, 2, meta(6, b'loopEnd'))]
    for index, name in enumerate(CHAPTERS):
        conductor.append((index * 32 * 4 * PPQ, 1, meta(6, name.encode())))
    chunks = [CASINO.midi_chunk(conductor)]
    for track, (name, channel, program, pan) in enumerate(CASINO.TRACKS):
        events = [(0, 0, meta(3, name.encode())),
                  (0, 0, bytes([0xc0 | channel, program])),
                  (0, 0, bytes([0xb0 | channel, 10, round(64 + pan * 50)])),
                  (BEATS * PPQ, 3, meta(6, b'loopEnd'))]
        for tr, beat, duration, pitch, velocity in notes:
            if tr == track:
                events.extend([(round(beat * PPQ), 2, bytes([0x90 | channel, pitch, velocity])),
                               (round((beat + duration) * PPQ), 1, bytes([0x80 | channel, pitch, 0]))])
        chunks.append(CASINO.midi_chunk(events))
    file.write_bytes(b'MThd' + struct.pack('>IHHH', 6, 1, len(chunks), PPQ) + b''.join(chunks))


def circular_add(mix, start, signal, gain):
    end = min(len(mix) - start, len(signal))
    mix[start:start + end] += signal[:end, None] * gain
    if end < len(signal):
        mix[:len(signal) - end] += signal[end:, None] * gain


def render(notes, ffmpeg):
    rng = np.random.default_rng(88231)
    count = SECONDS * SR
    mix = np.zeros((count, 2), dtype=np.float32)
    levels = [.082, .15, .055, .070, .035, .039, .031, .19]
    cache = {}
    for tr, beat, duration, pitch, velocity in notes:
        seconds = duration * SPB
        key = tr, pitch, round(seconds, 5)
        if key not in cache:
            sig = CASINO.voice(tr, pitch, seconds, rng)
            # Slightly soften the upper partials; the timbre remains the selected demo.
            if tr in (5, 6):
                sig = sosfilt(butter(2, 3100 if tr == 5 else 3800, fs=SR, output='sos'), sig).astype(np.float32)
            cache[key] = sig
        pan = CASINO.TRACKS[tr][3]
        gain = np.array([math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)], dtype=np.float32)
        gain *= levels[tr] * (velocity / 64) ** 1.35
        circular_add(mix, round(beat * SPB * SR), cache[key], gain)
    print('Applying circular ambience and steady-state filtering', flush=True)
    dry = mix.copy()
    for delay, gain in [(.071, .09), (.113, .07), (.179, .055), (.233, .043), (.307, .032), (.419, .02)]:
        shift = round(delay * SR)
        # Wrap the room reflections through the loop boundary as well as note releases.
        mix[shift:] += dry[:-shift, ::-1] * gain
        mix[:shift] += dry[-shift:, ::-1] * gain
    del dry
    sos = butter(2, [35, 11000], 'bandpass', fs=SR, output='sos')
    _, state = sosfilt(sos, mix[-SR * 2:], axis=0, zi=np.zeros((len(sos), 2, 2)))
    # Process in blocks to keep the 15-minute render's memory bounded.
    for start in range(0, count, SR * 10):
        end = min(count, start + SR * 10)
        filtered, state = sosfilt(sos, mix[start:end], axis=0, zi=state)
        mix[start:end] = filtered
    assert np.isfinite(mix).all()
    mix *= .78 / max(float(np.max(np.abs(mix))), .001)
    raw = OUT / f'{SLUG}-premaster.wav'
    with wave.open(str(raw), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        for start in range(0, count, SR * 10):
            wav.writeframes((mix[start:start + SR * 10] * 32767).astype('<i2').tobytes())
    del mix
    # One fixed gain over the entire orbit preserves the designed transition dynamics
    # and prevents a stateful loudness processor from changing the end/start balance.
    analysis = subprocess.run([ffmpeg, '-hide_banner', '-nostats', '-i', str(raw), '-af',
                               'loudnorm=I=-18:TP=-2:LRA=9:print_format=json', '-f', 'null', '-'],
                              capture_output=True, text=True, check=True)
    loudness, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind('{'):])
    gain_db = min(-18 - float(loudness['input_i']), -2.5 - float(loudness['input_tp']))
    master = OUT / f'{SLUG}.wav'
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(raw), '-af', f'volume={gain_db:.6f}dB',
                    '-c:a', 'pcm_s24le', str(master)], check=True)
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(master), '-c:a', 'flac',
                    '-metadata', 'LOOPSTART=0', '-metadata', f'LOOPEND={count}',
                    '-metadata', 'title=Midnight Circuit - Long Orbit',
                    str(OUT / f'{SLUG}.flac')], check=True)
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(master), '-ar', '44100',
                    '-codec:a', 'libmp3lame', '-b:a', '192k', '-metadata',
                    'title=Midnight Circuit - Long Orbit', str(OUT / f'{SLUG}.mp3')], check=True)
    # A concrete end -> beginning audition, with the actual join at 20 seconds.
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(master), '-filter_complex',
                    '[0:a]asplit=2[t][h];[t]atrim=start=880:end=900,asetpts=PTS-STARTPTS[tail];'
                    '[h]atrim=start=0:end=20,asetpts=PTS-STARTPTS[head];'
                    '[tail][head]concat=n=2:v=0:a=1[join]', '-map', '[join]',
                    '-codec:a', 'libmp3lame', '-b:a', '192k',
                    str(OUT / 'loop-seam-preview.mp3')], check=True)
    raw.unlink()
    return {'premasterIntegratedLUFS': float(loudness['input_i']),
            'appliedStaticGainDb': gain_db,
            'estimatedIntegratedLUFS': float(loudness['input_i']) + gain_db}


def validate(notes):
    assert len(notes) > 10000
    assert all(0 <= b < BEATS and b + d <= BEATS for _, b, d, _, _ in notes)
    # Layer envelopes join with matching value and slope and have no hard entrances.
    assert electronic_at(0) == electronic_at(BARS) == 0
    delta = max(abs(electronic_at(b + .0625) - electronic_at(b)) for b in np.arange(0, BARS, .0625))
    assert delta < .012
    assert harmony(BARS - 1)[0] % 12 == 4 and harmony(0)[0] % 12 == 9
    active = {}
    events = []
    for tr, beat, duration, pitch, velocity in notes:
        events.extend([(round(beat * PPQ), 1, tr, pitch),
                       (round((beat + duration) * PPQ), -1, tr, pitch)])
    for tick, change, tr, pitch in sorted(events):
        key = tr, pitch
        active[key] = active.get(key, 0) + change
        assert active[key] >= 0
    assert all(count == 0 for count in active.values())
    return {'noteCount': len(notes), 'maxEnvelopeChangePerSixteenth': delta,
            'allNotesReleased': True, 'lastToFirstHarmony': 'E7(b9) -> Am9'}


def main():
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg is required')
    OUT.mkdir(parents=True, exist_ok=True)
    print('Composing 384 bars at 102.4 BPM', flush=True)
    notes = compose()
    checks = validate(notes)
    write_midi(OUT / f'{SLUG}.mid', notes)
    print(f'Rendering {len(notes)} notes, exactly 900 seconds', flush=True)
    loudness = render(notes, ffmpeg)
    manifest = dict(title='Midnight Circuit - Long Orbit', bars=BARS, bpm=BPM,
                    durationSeconds=SECONDS, sampleRate=SR, loopStartSample=0,
                    loopEndSample=SECONDS * SR, meter='4/4',
                    chapters=[dict(name=name, startBar=index * 32 + 1,
                                   startSeconds=index * 32 * 4 * SPB)
                              for index, name in enumerate(CHAPTERS)],
                    electronicSwells=[dict(centreBar=c + 1, centreSeconds=c * 4 * SPB,
                                            riseBars=8, peakBars=4, fallBars=8)
                                      for c in ELECTRONIC_CENTRES],
                    validation=checks, loudness=loudness)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Done: WAV / FLAC / MP3 / MIDI and loop-seam-preview.mp3', flush=True)


if __name__ == '__main__':
    main()
