"""Procedural score + sound design for 《前夜》, driven by timeline.json.

python3 music.py timeline.json score.wav
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, oaconvolve

SR = 44100
tl = json.load(open(sys.argv[1]))
TOTAL = tl['total'] + 0.5
N = int(TOTAL * SR)
S = {s['id']: s['start'] for s in tl['scenes']}
rs = np.random.default_rng(2023)

dry = np.zeros((N, 2), np.float32)
send = np.zeros((N, 2), np.float32)   # reverb send
pads = np.zeros((N, 2), np.float32)   # low-passed before mixing


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pan(sig, p):  # p in [-1, 1]
    a = (p + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1).astype(np.float32)


def add(buf, t, st):
    i = int(t * SR)
    if i >= N:
        return
    if i < 0:
        st = st[-i:]
        i = 0
    n = min(len(st), N - i)
    buf[i:i + n] += st[:n]


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


# ---------------- instruments ----------------
def pad_note(m, dur, att=1.8, rel=2.8, bright=1.0):
    L = dur + rel
    t = np.arange(int(L * SR)) / SR
    f = midi_hz(m)
    sig = np.zeros_like(t)
    for det in (-0.0035, 0.0, 0.0035):
        ph = rs.uniform(0, 2 * np.pi, 8)
        vib = 1 + 0.0012 * np.sin(2 * np.pi * (0.18 + rs.uniform(0, 0.1)) * t)
        for n in range(1, 8):
            fn = f * n * (1 + det)
            if fn > 9000:
                break
            sig += np.sin(2 * np.pi * fn * t * vib + ph[n]) / n ** (1.6 - 0.35 * bright)
    env = np.minimum(1, t / att) ** 1.5
    env *= np.where(t > dur, np.exp(-(t - dur) / (rel / 3.5)), 1)
    return (sig * env / 6).astype(np.float32)


def piano(m, vel=0.5, length=4.5):
    t = np.arange(int(length * SR)) / SR
    f = midi_hz(m)
    sig = np.zeros_like(t)
    B = 0.0004
    for n in range(1, 8):
        fn = f * n * np.sqrt(1 + B * n * n)
        if fn > 12000:
            break
        a = 1 / n ** 1.4 * (1 + 0.6 * vel * (n > 2))
        dec = (0.9 + 0.55 * n) * (1 + max(0, m - 60) / 30)
        sig += a * np.sin(2 * np.pi * fn * t + rs.uniform(0, 6.28)) * np.exp(-t * dec)
    sig += 0.35 * np.sin(2 * np.pi * f * t) * np.exp(-t * 0.45)  # sustain body
    att = np.minimum(1, t / 0.004)
    ham = hp(rs.standard_normal(len(t)), 1500) * np.exp(-t / 0.008) * 0.04
    return ((sig * att + ham) * vel * 0.32).astype(np.float32)


def bell(m, vel=0.6, length=6.0):
    t = np.arange(int(length * SR)) / SR
    f = midi_hz(m)
    sig = np.zeros_like(t)
    for r, a, d in [(1, 1, 3.2), (2.0, 0.45, 2.4), (2.76, 0.55, 1.8), (5.40, 0.22, 0.9), (8.93, 0.10, 0.5)]:
        sig += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d)
    return (sig * np.minimum(1, t / 0.002) * vel * 0.18).astype(np.float32)


def boom(g=1.0):
    L = 4.0
    t = np.arange(int(L * SR)) / SR
    fr = 38 + 55 * np.exp(-t / 0.18)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    sub = np.sin(ph) * np.exp(-t / 1.1)
    nz = lp(rs.standard_normal(len(t)), 180) * np.exp(-t / 0.22) * 0.9
    air = bp(rs.standard_normal(len(t)), 800, 5000) * np.exp(-t / 0.6) * 0.04
    return ((sub * 0.9 + nz + air) * g * 0.75).astype(np.float32)


def kick(g=0.4):
    t = np.arange(int(0.6 * SR)) / SR
    fr = 45 + 50 * np.exp(-t / 0.04)
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.2)
    return (s * g).astype(np.float32)


def click(g=0.5):
    t = np.arange(int(0.05 * SR)) / SR
    nz = hp(rs.standard_normal(len(t)), 2500) * np.exp(-t / 0.0035)
    th = np.sin(2 * np.pi * rs.uniform(160, 220) * t) * np.exp(-t / 0.012) * 0.5
    return ((nz * 0.6 + th) * g).astype(np.float32)


def tick(g=0.35):
    t = np.arange(int(0.08 * SR)) / SR
    s = np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.006) + hp(rs.standard_normal(len(t)), 4000) * np.exp(-t / 0.002) * 0.5
    return (s * g).astype(np.float32)


def noise_sweep(L, f0, f1, env, seg=0.05):
    """band-limited noise whose band centre glides f0->f1 (log), shaped by env(p)."""
    n = int(L * SR)
    x = rs.standard_normal(n)
    out = np.zeros(n)
    hop = int(seg * SR)
    win = np.hanning(2 * hop)
    for i in range(0, n - hop, hop):
        p = i / n
        fc = f0 * (f1 / f0) ** p
        chunk = x[i:i + 2 * hop]
        y = bp(chunk, max(30, fc * 0.6), min(SR / 2 - 100, fc * 1.6))
        out[i:i + len(y)] += y * win[:len(y)]
    p = np.arange(n) / n
    return (out * env(p)).astype(np.float32)


# ---------------- harmony ----------------
CH = {
    'Am': (45, [57, 60, 64, 71]), 'F': (41, [53, 57, 60, 64]), 'C': (48, [55, 60, 64, 67]),
    'G': (43, [55, 59, 62, 67]), 'Dm': (38, [53, 57, 62, 65]), 'E': (40, [56, 59, 64, 68]),
    'Em': (40, [55, 59, 64, 67]), 'Gsus': (43, [55, 60, 62, 67]), 'Cadd9': (36, [55, 60, 62, 64, 67]),
    'G/B': (47, [55, 59, 62, 67]),
}


def prog(t0, t1, names, d):
    out, t, i = [], t0, 0
    while t < t1 - 0.01:
        out.append((t, min(t1, t + d), names[i % len(names)]))
        t += d
        i += 1
    return out


def chord_at(chords, t):
    for a, b, n in chords:
        if a <= t < b:
            return n
    return chords[-1][2]


def play_pads(chords, level, bright=1.0, bass=True, att=1.8, rel=2.8):
    for a, b, n in chords:
        root, voi = CH[n]
        for j, m in enumerate(voi):
            add(pads, a, pan(pad_note(m, b - a, att, rel, bright) * level * 0.55, -0.6 + 1.2 * j / max(1, len(voi) - 1)))
        if bass:
            add(pads, a, pan(pad_note(root, b - a, att, rel, 0.3) * level * 0.7, 0))


ARP = [0, 2, 4, 3, 5, 7, 6, 4]


def play_arp(chords, t0, t1, step, vel, octave=12, seed=0):
    r = np.random.default_rng(seed)
    t, k, last = t0, 0, None
    while t < t1:
        n = chord_at(chords, t)
        voi = CH[n][1]
        tones = sorted(voi + [v + 12 for v in voi])
        m = tones[ARP[k % len(ARP)] % len(tones)] + octave - 12
        v = vel * r.uniform(0.75, 1.0) * (1.25 if n != last else 1.0)
        note = piano(m, v)
        p = r.uniform(-0.45, 0.45)
        add(dry, t, pan(note, p))
        add(send, t, pan(note * 0.7, p))
        last = n
        t += step
        k += 1


def play_notes(notes, vel=0.45):
    for t, m in notes:
        n = piano(m, vel)
        add(dry, t, pan(n, 0.1))
        add(send, t, pan(n * 0.8, 0.1))


def play_pulse(t0, t1, step, g):
    t = t0
    while t < t1:
        add(dry, t, pan(kick(g), 0))
        t += step


# ---------------- score ----------------
# open: drone
play_pads([(0.0, 9.6, 'Am')], 0.22, bright=0.4, att=4.0)
# title
play_pads([(9.6, 18.4, 'Am')], 0.75, att=1.2)
play_notes([(10.4, 76), (11.7, 72), (13.0, 71), (14.3, 69), (16.0, 64)], 0.42)
# prologue
pro = prog(S['prologue'], S['prologue'] + 13.2, ['F', 'C', 'G', 'Am'], 3.3)
play_pads(pro, 0.6)
play_arp(pro, S['prologue'] + 0.5, S['prologue'] + 12.8, 1.1, 0.3, seed=1)
# chapters 2017-2021
c1 = prog(S['y2017'], S['decision'], ['Am', 'F', 'C', 'G'], 5.0)
play_pads([c for c in c1 if c[0] < S['y2022']], 0.62)
play_arp(c1, S['y2017'] + 2.4, S['y2020'], 0.75, 0.33, seed=2)
play_arp(c1, S['y2020'], S['y2021'], 0.5, 0.33, seed=3)
play_arp(c1, S['y2021'], S['hhh'], 0.5, 0.34, seed=4)
play_pulse(S['y2021'] + 3.0, S['hhh'] - 1.0, 1.0, 0.28)
play_arp(c1, S['hhh'] + 2.0, S['y2022'], 0.75, 0.28, seed=5)
c2 = prog(S['y2022'], S['decision'], ['Am', 'F', 'C', 'G'], 4.0)
play_pads(c2, 0.68, bright=1.15)
play_arp(c2, S['y2022'] + 1.5, S['decision'] - 0.6, 0.375, 0.3, seed=6)
play_pulse(S['y2022'] + 3.0, S['decision'] - 0.8, 0.75, 0.32)
# decision
D = S['decision']
cd = prog(D, D + 16.3, ['Dm', 'Am', 'F', 'E'], 4.075)
play_pads(cd, 0.66, rel=0.6)
play_arp(cd, D + 1.0, D + 16.1, 0.75, 0.27, seed=7)
play_pulse(D + 3.0, D + 16.0, 1.5, 0.36)
play_pads([(D + 16.3, D + 27.0, 'Am')], 0.3, bright=0.5, att=3.0, rel=2.5)
play_notes([(D + 16.3, 33), (D + 16.3, 45), (D + 19.6, 76), (D + 22.0, 72), (D + 24.4, 71), (D + 26.2, 69)], 0.4)
# chatgpt
C = S['chatgpt']
cc = prog(C + 2.0, C + 19.0, ['Am', 'F', 'C', 'G'], 2.0)
play_pads(cc, 0.8, bright=1.3, att=0.6, rel=2.0)
play_arp(cc, C + 2.0, C + 18.0, 0.25, 0.34, seed=8)
play_pulse(C + 2.0, C + 16.5, 0.5, 0.5)
# constitutional AI + naming
A = S['cai']
ca = prog(A, S['name'] + 13.2, ['F', 'G', 'Em', 'Am'], 4.0)
play_pads(ca, 0.55)
play_arp(ca, A + 1.5, S['name'], 0.75, 0.27, seed=9)
play_arp(ca, S['name'], S['name'] + 13.0, 1.0, 0.25, seed=10)
cn = prog(S['name'] + 13.2, S['dawn'] + 0.2, ['C', 'G/B', 'Am', 'F'], 3.0)
play_pads(cn, 0.62)
play_arp(cn, S['name'] + 13.4, S['dawn'] - 0.6, 0.5, 0.28, seed=11)
# dawn
Dn = S['dawn']
play_pads([(Dn, Dn + 5.0, 'Gsus')], 0.4, bright=0.6, att=1.0, rel=0.8)
cdn = [(Dn + 5.0, Dn + 9.0, 'Cadd9'), (Dn + 9.0, Dn + 12.5, 'G'), (Dn + 12.5, Dn + 15.6, 'Am'), (Dn + 15.6, Dn + 18.8, 'F'), (Dn + 18.8, Dn + 25.5, 'Cadd9')]
play_pads(cdn, 0.95, bright=1.35, att=1.0, rel=3.5)
play_pads([(a, b, n) for a, b, n in cdn], 0.35, bright=1.4, bass=False, att=2.0, rel=3.5)  # doubled shimmer layer
play_arp(cdn, Dn + 5.0, Dn + 22.0, 0.375, 0.36, seed=12)
play_pulse(Dn + 5.0, Dn + 18.6, 0.75, 0.3)
play_notes([(Dn + 18.8, 48), (Dn + 18.8, 60), (Dn + 18.8, 76)], 0.5)
# epilogue
E = S['epilogue']
ce = prog(E, E + 30.0, ['Am', 'F', 'C', 'G'], 5.0)
play_pads(ce, 0.38, bright=0.7, att=2.5)
play_arp(ce, E + 8.5, E + 29.0, 1.0, 0.26, seed=13)
# end card
En = S['end']
play_pads([(En, En + 11.0, 'Cadd9')], 0.45, bright=0.8, att=2.0, rel=3.0)
play_notes([(En + 0.3, 72), (En + 1.8, 67), (En + 3.3, 64), (En + 5.5, 60)], 0.34)

# ---------------- sound effects ----------------
for e in tl['sfx']:
    t, k = e['t'], e['k']
    if k == 'boom':
        b = boom(e.get('g', 1.0))
        add(dry, t, pan(b, 0))
        add(send, t, pan(b * 0.25, 0))
    elif k == 'bell':
        b = bell(e['n'] + 12, 0.7)
        add(dry, t, pan(b, 0))
        add(send, t, pan(b, 0))
    elif k == 'drop':
        add(dry, t, pan(boom(0.6), 0))
    elif k == 'shimmer':
        for i, m in enumerate([72, 76, 79, 83, 86, 88, 91]):
            b = bell(m, 0.45)
            add(dry, t + i * 0.09, pan(b, -0.5 + i / 6))
            add(send, t + i * 0.09, pan(b, -0.5 + i / 6))
    elif k == 'burst':
        for i in range(18):
            m = int(rs.choice([81, 84, 86, 88, 91, 93, 96]))
            b = bell(m, rs.uniform(0.15, 0.35), 4.0)
            tt = t + rs.uniform(0, 1.6)
            add(dry, tt, pan(b, rs.uniform(-0.9, 0.9)))
            add(send, tt, pan(b, rs.uniform(-0.9, 0.9)))
        wh = noise_sweep(2.5, 6000, 900, lambda p: np.exp(-p * 4) * (1 - np.exp(-p * 80)))
        add(dry, t, pan(wh * 0.35, 0))
        add(send, t, pan(wh * 0.3, 0))
    elif k == 'riser':
        L = e['d']
        r = noise_sweep(L, 250, 7000, lambda p: p ** 2.2)
        tt = np.arange(len(r)) / SR
        gl = np.sin(2 * np.pi * np.cumsum(200 * 4 ** (tt / L)) / SR) * (tt / L) ** 2 * 0.15
        add(dry, t, pan(r * 0.5 + gl.astype(np.float32), 0))
        add(send, t, pan(r * 0.3, 0))
    elif k == 'rewind':
        L = e['d']
        # reversed swell of a sustained chord + downward whoosh
        sw = np.zeros(int((L + 0.2) * SR), np.float32)
        for m in [57, 64, 69, 72, 76]:
            n = piano(m, 0.6, L + 0.2)
            sw[:len(n)] += n
        sw = sw[::-1] * np.linspace(0, 1, len(sw)) ** 2
        add(dry, t, pan(sw * 0.8, 0))
        add(send, t, pan(sw * 0.8, 0))
        wh = noise_sweep(L, 5000, 200, lambda p: np.sin(np.pi * p) ** 2)
        add(dry, t, pan(wh * 0.45, 0))
    elif k == 'dawn':
        pass  # carried by the score

for t in tl['typing']:
    add(dry, t, pan(click(rs.uniform(0.14, 0.22)), rs.uniform(-0.2, 0.2)))
for k in range(1, 9):
    add(dry, S['open'] + k, pan(tick(0.15), 0.15))
for k in range(1, 5):
    add(dry, S['dawn'] + k, pan(tick(0.2), 0.15))

# ---------------- mix ----------------
pads[:] = lp(pads, 2400).astype(np.float32)
dry += pads * 0.55
send += pads * 0.45

ir_len = int(3.6 * SR)
ti = np.arange(ir_len) / SR
ir = np.stack([lp(rs.standard_normal(ir_len), 5000) * np.exp(-ti / 0.75) for _ in range(2)], axis=1)
ir[:int(0.025 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([oaconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1).astype(np.float32)

mix = dry + wet * 0.55
mix = hp(mix, 28).astype(np.float32)
# global fades
fade = np.ones(N, np.float32)
fi = int(1.0 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fo0, fo1 = int((tl['total'] - 3.0) * SR), int(tl['total'] * SR)
fade[fo0:fo1] = np.linspace(1, 0, fo1 - fo0)
fade[fo1:] = 0
mix *= fade[:, None]
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.4) / np.tanh(1.4) * 0.95
wavfile.write(sys.argv[2], SR, (mix * 32767).astype(np.int16))
print('wrote', sys.argv[2], f'{N / SR:.1f}s')
