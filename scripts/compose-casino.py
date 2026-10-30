"""Deterministic original MIDI scores and matching offline audio demos.

Requires numpy, scipy and ffmpeg. No samples or material from reference songs.
Run: python scripts/compose-casino.py
"""
from pathlib import Path
import json
import math
import shutil
import struct
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'music-demos'
SR = 32000
PPQ = 480
TRACKS = [
    ('Electric piano', 0, 4, -.24), ('Upright bass', 1, 32, -.06),
    ('Vibraphone', 2, 11, .30), ('Muted guitar', 3, 26, -.36),
    ('Analog pad', 4, 89, .32), ('Analog lead', 5, 81, .12),
    ('Arpeggiator', 6, 80, -.28), ('Drums', 9, 0, .05),
]
CONFIGS = [
    ('01-velvet-orbit', 'Velvet Orbit', 96, 50, .59, 'lounge'),
    ('02-chrome-jukebox', 'Chrome Jukebox', 100, 55, .57, 'shuffle'),
    ('03-midnight-circuit', 'Midnight Circuit', 104, 45, .50, 'retro'),
]
SECTIONS = [(0, 8, 'intro'), (8, 24, 'lounge'), (24, 28, 'electro'),
            (28, 40, 'lounge'), (40, 48, 'rock'), (48, 64, 'lounge'),
            (64, 68, 'synth-solo'), (68, 80, 'outro')]


def vlq(n):
    result = [n & 127]
    while n >> 7:
        n >>= 7
        result.insert(0, (n & 127) | 128)
    return bytes(result)


def meta(kind, data):
    return bytes([255, kind]) + vlq(len(data)) + data


def midi_chunk(events):
    previous = 0
    data = bytearray()
    for tick, priority, event in sorted(events, key=lambda e: (e[0], e[1])):
        data += vlq(tick - previous) + event
        previous = tick
    data += b'\x00\xff\x2f\x00'
    return b'MTrk' + struct.pack('>I', len(data)) + data


def write_midi(file, title, bpm, notes):
    conductor = [(0, 0, meta(3, title.encode())),
                 (0, 0, meta(0x51, int(60_000_000 / bpm).to_bytes(3, 'big'))),
                 (0, 0, meta(0x58, bytes([4, 2, 24, 8])))]
    for start, end, name in SECTIONS:
        conductor.append((start * 4 * PPQ, 1, meta(6, name.encode())))
    conductor.append((80 * 4 * PPQ, 2, meta(6, b'end')))
    chunks = [midi_chunk(conductor)]
    for track, (name, channel, program, pan) in enumerate(TRACKS):
        events = [(0, 0, meta(3, name.encode())),
                  (0, 0, bytes([0xC0 | channel, program])),
                  (0, 0, bytes([0xB0 | channel, 10, round(64 + pan * 50)])),
                  (0, 0, bytes([0xB0 | channel, 91, 28]))]
        for tr, beat, duration, pitch, velocity in notes:
            if tr == track:
                events.append((round(beat * PPQ), 2, bytes([0x90 | channel, pitch, velocity])))
                events.append((round((beat + duration) * PPQ), 1, bytes([0x80 | channel, pitch, 0])))
        chunks.append(midi_chunk(events))
    file.write_bytes(b'MThd' + struct.pack('>IHHH', 6, 1, len(chunks), PPQ) + b''.join(chunks))


def compose(index, tonic, swing, flavor):
    rng = np.random.default_rng(8100 + index)
    notes = []
    # Functional minor harmony: i9, iv9, iiø7, V7; relative-major B phrase.
    minor = [(0, [0, 3, 7, 10, 14]), (5, [0, 3, 7, 10, 14]),
             (2, [0, 3, 6, 10]), (7, [0, 4, 7, 10, 13]),
             (0, [0, 3, 7, 10, 14]), (8, [0, 4, 7, 11, 14]),
             (2, [0, 3, 6, 10]), (7, [0, 4, 7, 10, 13])]
    major = [(3, [0, 4, 7, 11, 14]), (8, [0, 4, 7, 11, 14]),
             (5, [0, 3, 7, 10, 14]), (10, [0, 4, 7, 10, 14]),
             (3, [0, 4, 7, 11, 14]), (0, [0, 3, 7, 10, 14]),
             (2, [0, 3, 6, 10]), (7, [0, 4, 7, 10, 13])]
    last_voicing = None

    def add(tr, t, d, p, v):
        assert 0 <= p <= 127 and d > 0 and t >= 0
        notes.append((tr, t, d, int(p), int(np.clip(v + rng.integers(-3, 4), 1, 110))))

    def swung(b):
        whole = math.floor(b)
        fraction = b - whole
        return whole + (fraction / .5 * swing if fraction < .5 else swing + (fraction - .5) / .5 * (1 - swing))

    motif = [[2, 1, 0, 1, 3], [0, 2, 3, 2, 1], [1, 0, 2, 1, 0]][index]
    for bar in range(80):
        section = next(name for start, end, name in SECTIONS if start <= bar < end)
        electronic = section in ('electro', 'synth-solo')
        rock = section == 'rock'
        intro = section == 'intro'
        ending = section == 'outro'
        phrase = bar % 8
        base = bar * 4
        prog = major if (bar // 8) % 3 == 2 and not rock else minor
        offset, intervals = prog[phrase]
        if rock:
            offset = [0, 0, 5, 5, 0, 7, 5, 7][phrase]
            intervals = [0, 3, 7, 10] if offset != 7 else [0, 4, 7, 10]
        if bar >= 78:
            offset, intervals = 0, [0, 3, 7, 10, 14]
        chordroot = tonic + offset
        if chordroot > 58:
            chordroot -= 12
        # Smooth rootless keyboard voicings, chosen by minimal voice movement.
        candidates = []
        for inversion in range(len(intervals)):
            pitches = sorted(chordroot + 12 + i for i in intervals[1:])
            for _ in range(inversion):
                pitches[0] += 12
                pitches.sort()
            while np.mean(pitches) > 74:
                pitches = [p - 12 for p in pitches]
            candidates.append(pitches)
        voicing = min(candidates, key=lambda c: abs(np.mean(c) - (np.mean(last_voicing) if last_voicing else 66)))
        last_voicing = voicing
        hits = [(.0, 1.25), (2.5, .9)] if not electronic else [(0, .65), (1.5, .45), (3, .65)]
        if intro and bar < 4:
            hits = [(0, 2.7)]
        if bar >= 78:
            hits = [(0, 3.5)]
        for at, duration in hits:
            for p in voicing:
                add(0, base + (at if electronic else swung(at)), duration, p, 49 if not rock else 54)
        # Bass walks in quarter notes; the last beat leads into the next root.
        bassroot = chordroot - 12
        if electronic:
            for step in range(8):
                add(1, base + step * .5, .34, bassroot + (12 if step in (3, 7) else 0), 62)
        else:
            nextoff = prog[(phrase + 1) % 8][0] if not rock else [0, 0, 5, 5, 0, 7, 5, 7][(phrase + 1) % 8]
            approach = tonic - 12 + nextoff - 1
            while approach - bassroot > 7:
                approach -= 12
            while bassroot - approach > 7:
                approach += 12
            walking = [bassroot, bassroot + 7, bassroot + (9 if rock else intervals[1]), approach]
            for beat, p in enumerate(walking):
                if intro and bar < 4 and beat % 2:
                    continue
                if bar >= 78 and beat:
                    continue
                add(1, base + beat, .78 if not rock else .66, p, 62 if beat % 2 == 0 else 55)
        if not intro or bar >= 4:
            for beat in (range(4) if electronic else [0, 2]):
                add(7, base + beat, .15, 36, 64 if electronic else 48)
            for beat in [1, 3]:
                add(7, base + beat, .16, 38 if rock or electronic else 37, 57 if rock else 43)
            for step in range(8):
                at = step * .5 if electronic or flavor == 'retro' else swung(step * .5)
                add(7, base + at, .08, 42 if electronic or rock else 51, 26 + (7 if step % 2 == 0 else 0))
            if phrase == 7 and bar < 76:
                for step in range(3):
                    add(7, base + 3 + step * .25, .1, 38 if electronic or rock else 37, 25 + step * 4)
        # Long pad entries share chord harmony, leaving headroom for the game.
        if (flavor == 'retro' or electronic or bar % 4 == 0) and not rock:
            for p in voicing[:3]:
                add(4, base, 3.7, p, 34 if electronic else 25)
        if rock or flavor == 'shuffle' and not intro and bar % 2 == 0:
            for beat in range(4):
                for p in (chordroot, chordroot + 7 + (2 if beat % 2 else 0)):
                    add(3, base + beat, .38, p + 12, 47)
        # Sparse, repeated two-bar motifs with a response, not continuous soloing.
        if bar % 2 == 0 and 4 <= bar < 76 and not electronic:
            melodytrack = 3 if rock else (2 if index != 1 else 0)
            rhythm = [(.5, .38), (1.5, .38), (2, .65), (3, .38), (3.5, .32)]
            if phrase in (0, 4):
                rhythm = rhythm[:3]
            for k, (at, dur) in enumerate(rhythm):
                degree = motif[k] % len(intervals)
                pitch = chordroot + 24 + intervals[degree]
                while pitch > 85:
                    pitch -= 12
                add(melodytrack, base + swung(at), dur, pitch, 56 if not rock else 62)
        if electronic:
            for step in range(16):
                # Consistent sixteenths, a simple up/down chord arpeggio.
                degree = [0, 1, 2, 3, 2, 1, 2, 1][step % 8] % len(intervals)
                add(6, base + step * .25, .17, chordroot + 24 + intervals[degree], 36 + (step % 4 == 0) * 7)
            for k in range(4):
                pitch = chordroot + 24 + intervals[motif[k] % len(intervals)]
                add(5, base + k * .75, .52, pitch, 45)
            if section == 'synth-solo' and bar % 2:
                for k, degree in enumerate([0, 1, 2, 3, 2, 1, 2, 3]):
                    add(5, base + 2 + k * .25, .16, chordroot + 24 + intervals[degree % len(intervals)], 43)
    return notes


def voice(tr, pitch, duration, rng):
    release = [.65, .12, 1.0, .22, .8, .18, .12, .3][tr]
    length = duration + release
    t = np.arange(max(1, round(length * SR)), dtype=np.float64) / SR
    f = 440 * 2 ** ((pitch - 69) / 12)
    gate = np.minimum(t / .006, 1) * np.exp(-np.maximum(t - duration, 0) / max(.025, release / 5))
    if tr == 0:
        sig = (np.sin(2 * np.pi * f * t + 1.2 * np.exp(-t * 7) * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t * 1.8)
               + .15 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 7))
    elif tr == 1:
        sig = sum(a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (2 + h)) for h, a in [(1, 1), (2, .32), (3, .13), (4, .05)])
        sig += .035 * rng.normal(size=len(t)) * np.exp(-t * 65)
    elif tr == 2:
        sig = (np.sin(2 * np.pi * f * t) + .23 * np.sin(2 * np.pi * f * 3.99 * t) * np.exp(-t * 4)) * np.exp(-t * 1.7) * (1 + .045 * np.sin(2 * np.pi * 5 * t))
    elif tr == 3:
        sig = sum((.6 ** (h - 1)) * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (3 + h * 2)) for h in range(1, min(10, int(SR / 2 / f))))
        sig = np.tanh(sig * 1.4) * .75
    elif tr == 4:
        gate = np.minimum(t / .22, 1) * np.exp(-np.maximum(t - duration, 0) / .19)
        sig = sum(np.sin(2 * np.pi * f * detune * t) + .16 * np.sin(2 * np.pi * f * detune * 2 * t) for detune in [.998, 1.002]) * .35
    elif tr in (5, 6):
        sig = np.zeros(len(t))
        vibrato = .002 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(t / .25, 1)
        for h in range(1, min(14, int(SR / 2 / f))):
            sig += np.sin(2 * np.pi * f * h * (t + vibrato / (2 * np.pi * f))) / h * np.exp(-h * t * (1.8 if tr == 6 else .6))
        sig *= .5
    else:
        noise = rng.normal(size=len(t))
        if pitch == 36:
            sig = np.sin(2 * np.pi * (47 * t + 3.5 * (1 - np.exp(-t * 32)))) * np.exp(-t * 21)
            sig += .035 * noise * np.exp(-t * 170)
        elif pitch == 38:
            sig = .42 * sosfilt(butter(1, 1700, 'high', fs=SR, output='sos'), noise) * np.exp(-t * 27) + .18 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 35)
        elif pitch == 37:
            sig = .23 * noise * np.exp(-t * 85) + .28 * np.sin(2 * np.pi * 790 * t) * np.exp(-t * 110)
        else:
            high = sosfilt(butter(1, 6200 if pitch == 42 else 4200, 'high', fs=SR, output='sos'), noise)
            sig = high * (.25 if pitch == 42 else .16) * np.exp(-t * (70 if pitch == 42 else 24))
        gate = np.minimum(t / .001, 1)
    return (sig * gate).astype(np.float32)


def render(file, bpm, notes, seed):
    rng = np.random.default_rng(seed)
    seconds = 80 * 4 * 60 / bpm + 2
    mix = np.zeros((round(seconds * SR), 2), dtype=np.float32)
    levels = [.082, .15, .055, .070, .035, .043, .035, .19]
    cache = {}
    for tr, beat, duration, pitch, velocity in notes:
        d = duration * 60 / bpm
        key = (tr, pitch, round(d, 4))
        if key not in cache:
            cache[key] = voice(tr, pitch, d, rng)
        sig = cache[key]
        start = round(beat * 60 / bpm * SR)
        size = min(len(sig), len(mix) - start)
        pan = TRACKS[tr][3]
        amp = levels[tr] * (velocity / 64) ** 1.35
        mix[start:start + size, 0] += sig[:size] * amp * math.sqrt((1 - pan) / 2)
        mix[start:start + size, 1] += sig[:size] * amp * math.sqrt((1 + pan) / 2)
    dry = mix.copy()
    for delay, level in [(.071, .09), (.113, .07), (.179, .055), (.233, .043), (.307, .032), (.419, .02)]:
        shift = round(delay * SR)
        mix[shift:] += dry[:-shift, ::-1] * level
    mix = sosfilt(butter(2, [35, 11500], 'bandpass', fs=SR, output='sos'), mix, axis=0).astype(np.float32)
    fadein = round(.06 * SR)
    fadeout = round(5 * SR)
    mix[:fadein] *= np.linspace(0, 1, fadein)[:, None]
    mix[-fadeout:] *= np.linspace(1, 0, fadeout)[:, None]
    assert np.all(np.isfinite(mix))
    peak = float(np.max(np.abs(mix)))
    mix *= .84 / max(peak, .001)
    with wave.open(str(file), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes((mix * 32767).astype('<i2').tobytes())
    return seconds, peak


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg is required for MP3 previews')
    manifest = []
    for index, (slug, title, bpm, tonic, swing, flavor) in enumerate(CONFIGS):
        print(f'Composing {title}', flush=True)
        notes = compose(index, tonic, swing, flavor)
        assert all(t + d <= 320 for _, t, d, _, _ in notes)
        midi = OUT / f'{slug}.mid'
        wav = OUT / f'{slug}.wav'
        mp3 = OUT / f'{slug}.mp3'
        write_midi(midi, title, bpm, notes)
        duration, peak = render(wav, bpm, notes, 271 + index)
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(wav), '-af',
                        'loudnorm=I=-18:TP=-2:LRA=9', '-ar', '44100', '-codec:a',
                        'libmp3lame', '-b:a', '192k', '-metadata', f'title={title}',
                        '-metadata', 'artist=Blackjack After Hours', str(mp3)], check=True)
        manifest.append(dict(title=title, file=slug, bpm=bpm, bars=80, meter='4/4',
                             durationSeconds=duration, noteCount=len(notes),
                             sections=[dict(startBar=s + 1, endBar=e, name=n,
                                            startSeconds=round(s * 240 / bpm, 3))
                                       for s, e, n in SECTIONS]))
        print(f'Done: {duration:.1f}s, {len(notes)} notes, {mp3.stat().st_size} bytes', flush=True)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
