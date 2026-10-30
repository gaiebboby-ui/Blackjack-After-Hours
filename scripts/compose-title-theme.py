"""Original 60-second, sample-looped casino title theme. Python + numpy/scipy + ffmpeg."""
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

spec = importlib.util.spec_from_file_location('casino', Path(__file__).with_name('compose-casino.py'))
casino = importlib.util.module_from_spec(spec)
spec.loader.exec_module(casino)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/music-demos/title-theme'
ASSETS = ROOT / 'assets/audio'
SLUG = 'neon-stakes-title'
SR = 32000
BPM = 128
SPB = 60 / BPM
BARS = 32
SECONDS = 60
PARTS = ['Neon Stakes - Hook', 'Raise the Lights', 'Chrome Run', 'All In - Return']
CHORDS = [
    (45, [0, 3, 7, 10, 14]), (45, [0, 3, 7, 10, 14]),
    (53, [0, 4, 7, 11, 14]), (55, [0, 4, 7, 10, 14]),
    (45, [0, 3, 7, 10, 14]), (50, [0, 3, 7, 10, 14]),
    (47, [0, 3, 6, 10]), (52, [0, 4, 7, 10, 13]),
]


def compose():
    notes = []
    rng = np.random.default_rng(128601)

    def add(tr, t, d, p, v):
        assert 0 <= t < 128 and t + d <= 128 and 0 <= p < 128
        notes.append((tr, t, d, p, int(np.clip(v + rng.integers(-2, 3), 1, 110))))

    # A two-bar syncopated hook; the answer resolves to a chord tone every phrase.
    rhythms = [[(0, .65), (.75, .2), (1.5, .35), (2, .6), (3, .35)],
               [(.5, .35), (1, .6), (2, .35), (2.75, .2), (3.5, .3)]]
    degrees = [[0, 2, 1, 0, 2], [3, 2, 1, 2, 0]]
    for bar in range(BARS):
        base = bar * 4
        root, ints = CHORDS[bar % 8]
        section = bar // 8
        energy = .5 - .5 * math.cos(2 * math.pi * (bar + .5) / BARS)
        # Short jazz voicings provide the casino colour under the driving rhythm.
        voicing = sorted(root + x for x in (ints[1:] if len(ints) == 5 else ints))
        voicing = [p + 12 if p < 60 else p for p in voicing]
        for at in (.5, 2, 3.5):
            for p in voicing:
                add(0, base + at, .31, p, 55 if at == 2 else 46)
        # Octave synth bass: repeated root/fifth hook, constant eighth-note grid.
        bass = root - 12
        for step, interval in enumerate([0, 0, 12, 0, 7, 0, 12, 7]):
            add(1, base + step * .5, .34 if step % 2 == 0 else .22,
                bass + interval, 73 if step % 2 == 0 else 60)
        for beat in range(4):
            add(7, base + beat, .16, 36, 82 if beat % 2 == 0 else 70)
        for beat in (1, 3):
            add(7, base + beat, .17, 38, 76)
            add(7, base + beat + .012, .11, 37, 31)
        for step in range(8):
            add(7, base + step * .5, .07, 42, 39 if step % 2 == 0 else 30)
        if section in (1, 2):
            for step in (3, 7, 11, 15):
                add(7, base + step * .25, .055, 42, 19)
        if bar % 8 == 7:
            for at, v in [(3.25, 32), (3.5, 39), (3.75, 47)]:
                add(7, base + at, .09, 38, v)
        # Low-key common-tone bed; it bridges changes without blunting the groove.
        for pitch in sorted(voicing)[:3]:
            add(4, base, 3.65, pitch, 25)
        # Guitar octave stabs briefly answer the hook in the middle eight.
        for at in (0, 1.5, 2.5):
            for pitch in (root + 12, root + 19):
                add(3, base + at, .23, pitch, 54 if section == 2 else 22)
        # Repeated recognisable motif with a brighter octave response in the lift.
        if not (section == 2 and bar % 4 in (1, 3)):
            rhythm = rhythms[bar % 2]
            for i, (at, duration) in enumerate(rhythm):
                degree = degrees[bar % 2][i] % len(ints)
                pitch = root + 24 + ints[degree]
                while pitch > 85:
                    pitch -= 12
                add(5, base + at, duration, pitch, 61 if section != 1 else 65)
                if section == 1 and i in (0, 3):
                    add(2, base + at, duration, pitch + (12 if pitch < 76 else 0), 35)
        # The arpeggiator smoothly swells towards the centre and recedes to the seam.
        for step in range(16):
            level = .5 - .5 * math.cos(2 * math.pi * (bar + step / 16) / BARS)
            degree = [0, 1, 2, 3, 2, 1, 2, 1][step % 8] % len(ints)
            add(6, base + step * .25, .14, root + 24 + ints[degree], round(18 + level * 19))
        if section == 2 and bar % 4 == 3:
            for step, degree in enumerate([0, 1, 2, 3, 2, 1, 0, 1]):
                add(5, base + 2 + step * .25, .14, root + 24 + ints[degree], 42)
    return notes


def write_midi(notes):
    meta = casino.meta
    end = 128 * casino.PPQ
    conductor = [(0, 0, meta(3, b'Neon Stakes - Title Theme')),
                 (0, 0, meta(0x51, (468750).to_bytes(3, 'big'))),
                 (0, 0, meta(0x58, bytes([4, 2, 24, 8]))),
                 (0, 1, meta(6, b'loopStart')), (end, 3, meta(6, b'loopEnd'))]
    for i, title in enumerate(PARTS):
        conductor.append((i * 8 * 4 * casino.PPQ, 1, meta(6, title.encode())))
    chunks = [casino.midi_chunk(conductor)]
    for tr, (name, channel, program, pan) in enumerate(casino.TRACKS):
        events = [(0, 0, meta(3, name.encode())), (0, 0, bytes([0xc0 | channel, program])),
                  (0, 0, bytes([0xb0 | channel, 10, round(64 + pan * 50)])),
                  (end, 3, meta(6, b'loopEnd'))]
        for track, beat, duration, pitch, vel in notes:
            if track == tr:
                events.extend([(round(beat * casino.PPQ), 2, bytes([0x90 | channel, pitch, vel])),
                               (round((beat + duration) * casino.PPQ), 1, bytes([0x80 | channel, pitch, 0]))])
        chunks.append(casino.midi_chunk(events))
    (OUT / f'{SLUG}.mid').write_bytes(b'MThd' + struct.pack('>IHHH', 6, 1, 9, casino.PPQ) + b''.join(chunks))


def synth(tr, pitch, duration, rng):
    if tr != 1:
        sig = casino.voice(tr, pitch, duration, rng)
        if tr == 5:
            sig = np.tanh(sig * 1.55) * .8
            sig = sosfilt(butter(2, 4800, fs=SR, output='sos'), sig).astype(np.float32)
        return sig
    t = np.arange(round((duration + .13) * SR)) / SR
    f = 440 * 2 ** ((pitch - 69) / 12)
    # Strong fundamental, restrained saw overtones, plucked attack, no tempo changes.
    sig = np.sin(2 * np.pi * f * t)
    for harmonic in range(2, 10):
        sig += .32 / harmonic * np.sin(2 * np.pi * f * harmonic * t) * np.exp(-t * harmonic * 3)
    gate = np.minimum(t / .004, 1) * np.exp(-np.maximum(t - duration, 0) / .026)
    return (np.tanh(sig * 1.15) * .8 * gate).astype(np.float32)


def main():
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg required')
    OUT.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    notes = compose()
    write_midi(notes)
    rng = np.random.default_rng(12860)
    count = SECONDS * SR
    mix = np.zeros((count, 2), dtype=np.float32)
    levels = [.075, .145, .048, .086, .034, .090, .044, .27]
    cache = {}
    for tr, beat, duration, pitch, velocity in notes:
        key = tr, pitch, duration
        if key not in cache:
            cache[key] = synth(tr, pitch, duration * SPB, rng)
        sig = cache[key]
        pan = casino.TRACKS[tr][3]
        gain = np.array([math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)], dtype=np.float32)
        gain *= levels[tr] * (velocity / 64) ** 1.25
        start = round(beat * SPB * SR)
        length = min(len(sig), count - start)
        mix[start:start + length] += sig[:length, None] * gain
        if length < len(sig):
            mix[:len(sig) - length] += sig[length:, None] * gain
    dry = mix.copy()
    for delay, level in [(.058, .065), (.117, .05), (.176, .04), (.293, .025)]:
        mix += np.roll(dry[:, ::-1], round(delay * SR), axis=0) * level
    sos = butter(2, [32, 12000], 'bandpass', fs=SR, output='sos')
    _, state = sosfilt(sos, mix[-SR * 2:], axis=0, zi=np.zeros((len(sos), 2, 2)))
    mix, _ = sosfilt(sos, mix, axis=0, zi=state)
    # Gentle saturation catches isolated transients while retaining punch.
    mix = np.tanh(mix * 1.8) / 1.8
    mix *= .82 / float(np.max(np.abs(mix)))
    raw = OUT / 'premaster.wav'
    with wave.open(str(raw), 'wb') as wav:
        wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(SR)
        wav.writeframes((mix * 32767).astype('<i2').tobytes())
    result = subprocess.run([ffmpeg, '-hide_banner', '-nostats', '-i', str(raw), '-af',
                             'loudnorm=I=-16:TP=-2:LRA=8:print_format=json', '-f', 'null', '-'],
                            capture_output=True, text=True, check=True)
    measurement, _ = json.JSONDecoder().raw_decode(result.stderr[result.stderr.rfind('{'):])
    gain_db = min(-16 - float(measurement['input_i']), -2.3 - float(measurement['input_tp']))
    master = OUT / f'{SLUG}.wav'
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(raw), '-af', f'volume={gain_db:.6f}dB',
                    '-c:a', 'pcm_s24le', str(master)], check=True)
    for ext, codec in [('flac', ['-c:a', 'flac']), ('mp3', ['-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k']),
                       ('ogg', ['-c:a', 'libvorbis', '-q:a', '6'])]:
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(master), *codec,
                        '-metadata', 'title=Neon Stakes - Title Theme',
                        '-metadata', 'LOOPSTART=0', '-metadata', f'LOOPEND={count}',
                        str(OUT / f'{SLUG}.{ext}')], check=True)
    for ext in ('ogg', 'mp3'):
        shutil.copyfile(OUT / f'{SLUG}.{ext}', ASSETS / f'title-theme.{ext}')
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(master), '-filter_complex',
                    '[0:a]asplit=2[t][h];[t]atrim=start=50:end=60,asetpts=PTS-STARTPTS[t1];'
                    '[h]atrim=start=0:end=10,asetpts=PTS-STARTPTS[h1];'
                    '[t1][h1]concat=n=2:v=0:a=1[out]', '-map', '[out]',
                    '-c:a', 'libmp3lame', '-b:a', '192k', str(OUT / 'loop-seam-preview.mp3')], check=True)
    raw.unlink()
    jump = float(np.max(np.abs(mix[0] - mix[-1]))) * 10 ** (gain_db / 20)
    assert jump < .003
    manifest = dict(title='Neon Stakes', durationSeconds=60, bpm=128, bars=32, meter='4/4',
                    loopStartSample=0, loopEndSample=count, sampleRate=SR, noteCount=len(notes),
                    estimatedLUFS=float(measurement['input_i']) + gain_db,
                    boundarySampleJumpDbFS=20 * math.log10(max(jump, 1e-12)),
                    parts=[dict(name=name, startSeconds=i * 15) for i, name in enumerate(PARTS)])
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(manifest, indent=2), flush=True)


if __name__ == '__main__':
    main()
