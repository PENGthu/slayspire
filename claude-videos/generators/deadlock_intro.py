"""Claude 介绍《Deadlock》的动态图形视频：Pillow 逐帧绘制 + numpy 合成配乐，ffmpeg 编码。

    python3 claude-videos/generators/deadlock_intro.py            # 输出到 claude-videos/
    python3 claude-videos/generators/deadlock_intro.py --preview  # 每个场景导出一张截图

画面全部为程序绘制的示意图，不使用任何游戏官方素材。
"""
import math
import os
import random
import subprocess
import sys
import wave
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 30
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
NAME = '2026-10-22-claude-deadlock-intro'
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'

BG = (12, 13, 18)
INK = (236, 230, 216)
DIM = (150, 146, 138)
AMBER = (232, 162, 58)
SAPPHIRE = (74, 140, 232)
CLAUDE = (217, 119, 87)
WEAPON = (236, 140, 60)
VITALITY = (110, 196, 104)
SPIRIT = (170, 120, 230)


# ---------- 工具 ----------

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ramp(t, start, dur=0.5):
    return ease((t - start) / dur)


def lerp(a, b, k):
    return a + (b - a) * k


def rgba(c, a=1.0):
    return (c[0], c[1], c[2], int(255 * clamp(a)))


@lru_cache(maxsize=None)
def font(size):
    return ImageFont.truetype(FONT, size)


def text(d, xy, s, size, color=INK, a=1.0, anchor='mm', stroke=0, stroke_color=None):
    if a <= 0:
        return
    d.text(xy, s, font=font(size), fill=rgba(color, a), anchor=anchor,
           stroke_width=stroke, stroke_fill=rgba(stroke_color or color, a))


def text_in(d, xy, s, size, t, start, color=INK, anchor='mm', rise=24, stroke=0):
    """从下方淡入的文字。"""
    k = ramp(t, start, 0.6)
    text(d, (xy[0], xy[1] + rise * (1 - k)), s, size, color, k, anchor, stroke)


def rounded(d, box, r, fill=None, outline=None, width=2):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def spark(d, cx, cy, r, color, a=1.0, rot=0.0, width=10):
    """Claude 的八芒星标记。"""
    for i in range(8):
        ang = rot + i * math.pi / 4
        rr = r if i % 2 == 0 else r * 0.62
        d.line([(cx, cy), (cx + rr * math.cos(ang), cy + rr * math.sin(ang))], fill=rgba(color, a), width=width)
    d.ellipse([cx - width, cy - width, cx + width, cy + width], fill=rgba(color, a))


def glow(layer, radius=18, strength=1.0):
    """给图层加一层柔光。"""
    blur = layer.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1.0:
        r, g, b, al = blur.split()
        al = al.point(lambda v: int(clamp(v * strength / 255) * 255))
        blur = Image.merge('RGBA', (r, g, b, al))
    out = Image.alpha_composite(blur, layer)
    return out


# ---------- 背景 ----------

def make_background():
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    vign = 1 - 0.55 * ((x - 0.5) ** 2 + (y - 0.45) ** 2 * 1.4)
    base = np.array(BG, dtype=np.float32)[None, None, :] * (0.7 + 0.5 * vign[..., None])
    warm = np.exp(-((x - 0.5) ** 2 * 3 + (y - 1.1) ** 2 * 4))[..., None] * np.array([40, 22, 6])
    img = Image.fromarray(np.clip(base + warm, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    # 装饰艺术风格的放射线与边框
    deco = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(deco)
    for i in range(-12, 13):
        ang = math.pi / 2 + i * 0.09
        d.line([(W / 2, H + 200), (W / 2 + 2400 * math.cos(ang), H + 200 - 2400 * math.sin(ang))],
               fill=rgba(AMBER, 0.035), width=2)
    for inset, a in ((28, 0.22), (40, 0.1)):
        d.rectangle([inset, inset, W - inset, H - inset], outline=rgba(AMBER, a), width=2)
    for cx, cy in ((28, 28), (W - 28, 28), (28, H - 28), (W - 28, H - 28)):
        d.regular_polygon((cx, cy, 10), 4, rotation=45, fill=rgba(AMBER, 0.5))
    return Image.alpha_composite(img, deco)


# ---------- 字幕 ----------

def wrap(s, size, max_w):
    lines, cur = [], ''
    f = font(size)
    for ch in s:
        if f.getlength(cur + ch) > max_w and ch not in '，。、；：！？」）》':
            lines.append(cur)
            cur = ch.lstrip()
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def caption(d, s, t, dur, fade):
    """底部的 Claude 旁白：打字机效果。"""
    if not s:
        return
    size = 40
    typed = clamp(t / (dur * 0.55))
    n = int(len(s) * typed + 0.999)
    lines = wrap(s, size, 1480)
    shown, left = [], n
    for ln in lines:
        shown.append(ln[:max(0, left)])
        left -= len(ln)
    box_h = 56 * len(lines) + 44
    top = H - 70 - box_h
    rounded(d, [180, top, W - 180, H - 70], 18, fill=rgba((8, 8, 12), 0.72 * fade), outline=rgba(CLAUDE, 0.45 * fade))
    spark(d, 228, top + 50, 18, CLAUDE, fade, rot=t * 0.8, width=4)
    for i, ln in enumerate(shown):
        text(d, (270, top + 28 + 56 * i), ln, size, INK, fade, anchor='la')


# ---------- 场景 ----------

def scene_intro(d, t, layer):
    k = ramp(t, 0.2, 0.8)
    spark(d, W / 2, 250, 60 * k, CLAUDE, k, rot=t * 0.6, width=12)
    text_in(d, (W / 2, 370), 'Claude 带你认识', 52, t, 0.6, DIM)
    word = 'DEADLOCK'
    f = font(210)
    total = f.getlength(word) + 30 * (len(word) - 1)
    x = W / 2 - total / 2
    for i, ch in enumerate(word):
        kk = ramp(t, 1.2 + i * 0.09, 0.5)
        cw = f.getlength(ch)
        text(d, (x + cw / 2, 540 - 60 * (1 - kk)), ch, 210, AMBER, kk, stroke=2)
        x += cw + 30
    lk = ramp(t, 2.3, 0.8)
    d.line([(W / 2 - 520 * lk, 660), (W / 2 + 520 * lk, 660)], fill=rgba(AMBER, 0.8 * lk), width=3)
    text_in(d, (W / 2, 720), 'Valve 出品 · 6v6 第三人称射击 × MOBA', 46, t, 2.8)


def crosshair(d, cx, cy, r, color, a):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(color, a), width=6)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        d.line([(cx + dx * r * 0.35, cy + dy * r * 0.35), (cx + dx * r * 1.3, cy + dy * r * 1.3)], fill=rgba(color, a), width=6)
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=rgba(color, a))


def mini_map(d, cx, cy, s, a):
    rounded(d, [cx - s, cy - s, cx + s, cy + s], 16, outline=rgba(INK, a), width=5)
    for off in (-0.55, 0, 0.55):
        d.line([(cx + off * s, cy - s * 0.8), (cx + off * s, cy + s * 0.8)], fill=rgba(INK, a * 0.8), width=5)
    d.ellipse([cx - 18, cy + s * 0.8 - 18, cx + 18, cy + s * 0.8 + 18], fill=rgba(AMBER, a))
    d.ellipse([cx - 18, cy - s * 0.8 - 18, cx + 18, cy - s * 0.8 + 18], fill=rgba(SAPPHIRE, a))


def scene_what(d, t, layer):
    text_in(d, (W / 2, 130), '它是什么？', 64, t, 0.1, AMBER)
    k1, k2 = ramp(t, 0.5), ramp(t, 1.2)
    crosshair(d, 560, 380 + 20 * (1 - k1), 90, INK, k1)
    text(d, (560, 540), '第三人称射击', 46, INK, k1)
    text(d, (560, 595), '亲手瞄准、开枪、走位', 32, DIM, k1)
    text(d, (W / 2, 400), '+', 110, AMBER, ramp(t, 0.9))
    mini_map(d, 1360, 380 + 20 * (1 - k2), 100, k2)
    text(d, (1360, 540), 'MOBA', 46, INK, k2)
    text(d, (1360, 595), '推线、发育、拆塔', 32, DIM, k2)
    facts = [('开发', 'Valve'), ('引擎', 'Source 2'), ('公开', '2024 年 8 月')]
    for i, (k, v) in enumerate(facts):
        kk = ramp(t, 2.2 + i * 0.35)
        x = W / 2 + (i - 1) * 420
        rounded(d, [x - 180, 660, x + 180, 760], 14, fill=rgba((24, 24, 32), 0.9 * kk), outline=rgba(AMBER, 0.5 * kk))
        text(d, (x, 690), k, 28, DIM, kk)
        text(d, (x, 732), v, 38, INK, kk)


LANES = (-0.62, 0.0, 0.62)


def lane_point(lane, p, cx, cy, hw, hh):
    """三条兵线的曲线：p=0 在琥珀之手（下方）基地，p=1 在蓝宝石之焰（上方）基地。"""
    y = cy + hh * 0.82 - p * hh * 1.64
    bend = math.sin(p * math.pi)
    x = cx + lane * hw * (0.25 + 0.75 * bend ** 0.6)
    return x, y


def scene_map(d, t, layer):
    cx, cy, hw, hh = 760, 450, 330, 340
    k = ramp(t, 0.2, 0.8)
    rounded(d, [cx - hw - 40, cy - hh - 20, cx + hw + 40, cy + hh + 20], 24,
            fill=rgba((18, 20, 26), 0.95 * k), outline=rgba(INK, 0.35 * k))
    for li, lane in enumerate(LANES):
        draw_k = ramp(t, 0.6 + li * 0.25, 1.0)
        pts = [lane_point(lane, i / 60, cx, cy, hw, hh) for i in range(int(60 * draw_k) + 1)]
        if len(pts) > 1:
            d.line(pts, fill=rgba(INK, 0.55), width=10, joint='curve')
    for color, y, label in ((AMBER, cy + hh * 0.86, '琥珀之手'), (SAPPHIRE, cy - hh * 0.86, '蓝宝石之焰')):
        d.ellipse([cx - 34, y - 34, cx + 34, y + 34], fill=rgba(color, k), outline=rgba(INK, k), width=3)
    # 小兵沿线推进，在中间相遇
    if t > 2.0:
        for lane in LANES:
            for j in range(4):
                ph = ((t - 2.0) * 0.12 + j * 0.06) % 0.5
                for color, p in ((AMBER, ph), (SAPPHIRE, 1 - ph)):
                    x, y = lane_point(lane, p, cx, cy, hw, hh)
                    al = clamp((0.5 - ph) * 8) * clamp((t - 2.0) * 2)
                    d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=rgba(color, al))
    tx = 1260
    text_in(d, (tx, 190), '6 v 6', 110, t, 1.0, INK, anchor='lm', stroke=1)
    text_in(d, (tx, 330), '琥珀之手', 46, t, 1.4, AMBER, anchor='lm')
    text_in(d, (tx + 210, 330), 'vs', 36, t, 1.4, DIM, anchor='lm')
    text_in(d, (tx + 280, 330), '蓝宝石之焰', 46, t, 1.4, SAPPHIRE, anchor='lm')
    text_in(d, (tx, 440), '三条兵线', 64, t, 2.0, INK, anchor='lm')
    text_in(d, (tx, 510), '小兵会自动沿线推进、交战', 34, t, 2.4, DIM, anchor='lm')
    kk = ramp(t, 3.4)
    rounded(d, [tx - 10, 570, tx + 520, 640], 12, outline=rgba(AMBER, 0.6 * kk))
    text(d, (tx + 255, 605), '2025 年 2 月起由四路改为三路', 30, AMBER, kk)


def scene_souls(d, t, layer):
    text_in(d, (W / 2, 120), '经济系统：魂（Souls）', 60, t, 0.1, AMBER)
    # 左：击杀小兵 → 魂球 → 射击确认
    bx, by = 560, 420
    cyc = (t - 0.8) % 3.2 if t > 0.8 else -1
    alive = cyc < 0.6 or cyc > 2.2
    if alive:
        ak = 1.0 if cyc < 0.6 else ease((cyc - 2.2) / 0.3)
        d.ellipse([bx - 36, by - 36, bx + 36, by + 36], fill=rgba(SAPPHIRE, 0.9 * ak))
    else:
        orb_k = ease((cyc - 0.6) / 0.5)
        oy = by - 120 * orb_k
        shot = cyc > 1.6
        if not shot:
            d.ellipse([bx - 26, oy - 26, bx + 26, oy + 26], fill=rgba((190, 240, 230), 0.95))
            d.ellipse([bx - 44, oy - 44, bx + 44, oy + 44], outline=rgba((190, 240, 230), 0.4), width=3)
        if 1.1 < cyc < 1.7:
            d.line([(bx - 330, by + 160), (bx, oy)], fill=rgba(WEAPON, 0.9), width=5)
        if shot:
            burst = ease((cyc - 1.6) / 0.6)
            for i in range(10):
                ang = i * math.pi / 5
                r = 40 + 120 * burst
                d.ellipse([bx + r * math.cos(ang) - 6, oy + r * math.sin(ang) - 6,
                           bx + r * math.cos(ang) + 6, oy + r * math.sin(ang) + 6], fill=rgba((190, 240, 230), 1 - burst))
            text(d, (bx, oy - 90 * burst), '+ 魂', 40, (190, 240, 230), 1 - burst)
    crosshair(d, bx - 330, by + 160, 40, WEAPON, ramp(t, 0.4))
    souls = int(clamp(t / 9) * 4200)
    text_in(d, (bx, 720), f'魂  {souls:,}', 56, t, 0.6, (190, 240, 230))
    text_in(d, (bx, 785), '补刀掉落魂球，射中才能拿稳，还能抢断对手', 30, t, 1.0, DIM)
    # 右：三类装备
    cats = [('武器', 'Weapon', '枪械伤害 · 射速 · 弹匣', WEAPON),
            ('生命', 'Vitality', '生命值 · 护盾 · 续航', VITALITY),
            ('灵能', 'Spirit', '技能伤害 · 冷却 · 效果', SPIRIT)]
    for i, (zh, en, desc, c) in enumerate(cats):
        kk = ramp(t, 2.0 + i * 0.5)
        y = 290 + i * 170 + 30 * (1 - kk)
        x0 = 1000
        rounded(d, [x0, y - 65, x0 + 720, y + 65], 16, fill=rgba((22, 22, 30), 0.92 * kk), outline=rgba(c, 0.85 * kk), width=3)
        d.rectangle([x0, y - 65, x0 + 14, y + 65], fill=rgba(c, kk))
        text(d, (x0 + 60, y - 18), zh, 48, c, kk, anchor='lm')
        text(d, (x0 + 180, y - 18), en, 30, DIM, kk, anchor='lm')
        text(d, (x0 + 60, y + 32), desc, 30, INK, kk, anchor='lm')
    text_in(d, (1360, 790), '用魂在商店购买装备', 34, t, 3.6, INK)


def scene_objectives(d, t, layer):
    text_in(d, (W / 2, 130), '获胜路线', 64, t, 0.1, AMBER)
    steps = [('守卫', 'Guardian', '每条兵线的第一道防线'),
             ('巡游者', 'Walker', '会移动、会反击的巨像'),
             ('神殿', 'Shrines', '保护基地核心'),
             ('庇护者', 'Patron', '击败它即可获胜')]
    xs = [W / 2 + (i - 1.5) * 420 for i in range(4)]
    for i, ((zh, en, desc), x) in enumerate(zip(steps, xs)):
        kk = ramp(t, 0.6 + i * 0.9, 0.6)
        lit = ramp(t, 1.0 + i * 0.9, 0.4)
        c = (int(lerp(DIM[0], AMBER[0], lit)), int(lerp(DIM[1], AMBER[1], lit)), int(lerp(DIM[2], AMBER[2], lit)))
        y = 430
        d.regular_polygon((x, y, 92), 4, rotation=45, fill=rgba((24, 22, 28), 0.95 * kk), outline=rgba(c, kk), width=5)
        text(d, (x, y - 6), str(i + 1), 64, c, kk)
        text(d, (x, y + 150), zh, 48, INK, kk)
        text(d, (x, y + 200), en, 28, DIM, kk)
        text(d, (x, y + 250), desc, 28, DIM, kk)
        if i < 3:
            ak = ramp(t, 1.2 + i * 0.9, 0.5)
            x1, x2 = x + 115, x + 115 + (420 - 230) * ak
            d.line([(x1, y), (x2, y)], fill=rgba(AMBER, ak), width=5)
            if ak > 0.9:
                d.polygon([(x2 + 14, y), (x2 - 6, y - 14), (x2 - 6, y + 14)], fill=rgba(AMBER, ak))
    kk = ramp(t, 4.6)
    rounded(d, [W / 2 - 520, 770, W / 2 + 520, 840], 14, outline=rgba(SPIRIT, 0.7 * kk), width=2)
    text(d, (W / 2, 805), '中路 Boss 会掉落「复苏者」（Rejuvenator），为全队提供强力增益', 30, INK, kk)


def scene_move(d, t, layer):
    text_in(d, (W / 2, 120), '灵活的移动', 64, t, 0.1, AMBER)
    # 滑索
    y0 = 300
    k = ramp(t, 0.4, 0.8)
    d.line([(260, y0), (260 + 1400 * k, y0 + 60 * k)], fill=rgba(INK, 0.8), width=5)
    for px in (260, 1660):
        d.line([(px, y0 - 20 + (60 if px > 260 else 0)), (px, y0 + 120 + (60 if px > 260 else 0))], fill=rgba(DIM, k), width=8)
    if t > 1.2:
        p = ((t - 1.2) * 0.35) % 1
        x, y = 260 + 1400 * p, y0 + 60 * p
        d.line([(x, y), (x, y + 40)], fill=rgba(INK, 0.9), width=4)
        d.ellipse([x - 22, y + 40, x + 22, y + 84], fill=rgba(AMBER, 1))
        for j in range(1, 6):
            xx = x - j * 40
            if xx > 260:
                d.line([(xx, y + 62 - j * 2.4), (xx - 30, y + 62 - j * 2.4)], fill=rgba(AMBER, 0.5 - j * 0.08), width=4)
    text_in(d, (960, 500), '滑索（Zipline）：沿兵线上方快速转线、回到前线', 36, t, 0.8)
    # 三个动作
    moves = [('冲刺', 'Dash'), ('滑铲', 'Slide'), ('冲刺跳', 'Dash-jump'), ('格挡', 'Parry')]
    for i, (zh, en) in enumerate(moves):
        kk = ramp(t, 1.8 + i * 0.4)
        x = W / 2 + (i - 1.5) * 380
        y = 660
        rounded(d, [x - 160, y - 90, x + 160, y + 90], 18, fill=rgba((22, 22, 30), 0.92 * kk), outline=rgba(AMBER if i < 3 else SPIRIT, 0.7 * kk), width=3)
        # 动作小图标
        ix, iy = x, y - 30
        c = rgba(AMBER if i < 3 else SPIRIT, kk)
        if i == 0:
            for j in range(3):
                d.line([(ix - 60 + j * 30, iy), (ix - 20 + j * 30, iy)], fill=c, width=6)
            d.polygon([(ix + 60, iy), (ix + 40, iy - 14), (ix + 40, iy + 14)], fill=c)
        elif i == 1:
            d.line([(ix - 60, iy + 14), (ix + 50, iy + 14)], fill=c, width=6)
            d.ellipse([ix + 30, iy - 12, ix + 56, iy + 14], fill=c)
        elif i == 2:
            d.arc([ix - 60, iy - 30, ix + 60, iy + 50], 200, 340, fill=c, width=6)
            d.polygon([(ix + 58, iy + 2), (ix + 40, iy - 12), (ix + 36, iy + 12)], fill=c)
        else:
            d.arc([ix - 34, iy - 34, ix + 34, iy + 34], 120, 420, fill=c, width=6)
            d.line([(ix, iy - 20), (ix, iy + 20)], fill=c, width=6)
        text(d, (x, y + 30), zh, 40, INK, kk)
        text(d, (x, y + 68), en, 26, DIM, kk)


def scene_status(d, t, layer):
    text_in(d, (W / 2, 120), '现状（截至 2026 年 10 月）', 60, t, 0.1, AMBER)
    items = [('仍是邀请制测试', '需要已有资格的朋友在 Steam 上邀请'),
             ('没有正式发售日', 'Steam 页面写着「待定」'),
             ('目前只支持 Windows', '仍处于早期开发阶段'),
             ('英雄阵容持续扩充', '新英雄先在「英雄实验室」（Hero Labs）中测试')]
    for i, (a, b) in enumerate(items):
        kk = ramp(t, 0.6 + i * 0.55)
        y = 270 + i * 135
        x0 = 620 + 40 * (1 - kk)
        d.regular_polygon((x0, y, 16), 4, rotation=45, fill=rgba(AMBER, kk))
        text(d, (x0 + 50, y - 18), a, 46, INK, kk, anchor='lm')
        text(d, (x0 + 50, y + 30), b, 30, DIM, kk, anchor='lm')


def scene_outro(d, t, layer):
    k = ramp(t, 0.2, 0.8)
    spark(d, W / 2, 300, 70 * k, CLAUDE, k, rot=t * 0.6, width=12)
    text_in(d, (W / 2, 470), '喜欢射击，又喜欢 MOBA？', 64, t, 0.6)
    text_in(d, (W / 2, 570), 'DEADLOCK 值得关注', 80, t, 1.2, AMBER, stroke=1)
    text_in(d, (W / 2, 760), '本视频由 Claude 生成 · 非官方内容 · 画面均为示意图', 30, t, 2.2, DIM)


# (开始, 时长, 绘制函数, 旁白)
SCENES = []
_t = 0.0
for dur, fn, cap in [
    (7.5, scene_intro, '大家好，我是 Claude。今天用一分钟，带你认识 Valve 的新游戏《Deadlock》。'),
    (10.0, scene_what, '它把第三人称射击和 MOBA 揉在了一起：你要亲手瞄准开枪，也要推线、发育、拆塔。'),
    (13.0, scene_map, '两支六人队伍——琥珀之手与蓝宝石之焰——在三条兵线上对抗，小兵会自动沿线推进、交战。'),
    (13.0, scene_souls, '补刀会掉落「魂」，这是游戏的经济。把魂球打下来才算拿稳，对手也能抢。攒下的魂用来购买武器、生命、灵能三类装备。'),
    (12.0, scene_objectives, '推进路线是：击破每条线上的守卫和巡游者，摧毁敌方基地的神殿，最后击败「庇护者」赢下比赛。'),
    (10.0, scene_move, '它的移动非常灵活：兵线上方有滑索，可以快速转线；冲刺、滑铲、冲刺跳一气呵成，还能格挡对手的近战攻击。'),
    (10.0, scene_status, '目前 Deadlock 仍是邀请制测试，没有正式发售日。想玩的话，需要已有资格的朋友在 Steam 上邀请你。'),
    (7.0, scene_outro, '我是 Claude，我们下次见！'),
]:
    SCENES.append((_t, dur, fn, cap))
    _t += dur
DURATION = _t
FADE = 0.45

_BG = None


def render(frame):
    global _BG
    if _BG is None:
        _BG = make_background()
    t = frame / FPS
    img = _BG.copy()
    for start, dur, fn, cap in SCENES:
        lt = t - start
        if -FADE < lt < dur:
            fade = clamp(min((lt + FADE) / FADE, (dur - lt) / FADE))
            if fn is scene_intro:
                fade = clamp((dur - lt) / FADE) * clamp(t / 0.6)
            if fn is scene_outro:
                fade = min(clamp((lt + FADE) / FADE), clamp((DURATION - t) / 1.2))
            layer = Image.new('RGBA', (W, H))
            d = ImageDraw.Draw(layer)
            fn(d, max(0.0, lt), layer)
            if fn in (scene_intro, scene_outro):
                layer = glow(layer, 14, 0.9)
            if lt >= 0:
                caption(ImageDraw.Draw(layer), cap, lt, dur, 1.0)
            if fade < 1:
                al = layer.getchannel('A').point(lambda v, f=fade: int(v * f))
                layer.putalpha(al)
            img = Image.alpha_composite(img, layer)
    return img.convert('RGB').tobytes()


# ---------- 配乐 ----------

SR = 44100


def synth_music(path):
    n = int(DURATION * SR)
    t = np.arange(n) / SR
    bpm = 96
    beat = 60 / bpm
    bar = beat * 4
    # Am - F - C - G 的柔和铺底
    chords = [(57, 60, 64), (53, 57, 60), (48, 55, 60), (55, 59, 62)]
    out = np.zeros(n)
    mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
    for bi in range(int(DURATION / bar) + 1):
        s, e = int(bi * bar * SR), min(n, int((bi + 1) * bar * SR))
        if s >= n:
            break
        seg = t[s:e] - bi * bar
        env = np.minimum(1, seg / 0.6) * np.minimum(1, (bar - seg) / 0.4)
        for m in chords[bi % 4]:
            f = mtof(m)
            out[s:e] += 0.05 * env * (np.sin(2 * np.pi * f * seg) + 0.3 * np.sin(2 * np.pi * 2 * f * seg + 0.5)
                                      + 0.15 * np.sin(2 * np.pi * 3 * f * seg))
        root = mtof(chords[bi % 4][0] - 12)
        for k in range(8):
            ps = k * beat / 2
            idx = (seg >= ps) & (seg < ps + beat / 2)
            st = seg[idx] - ps
            out[s:e][idx] += 0.08 * np.exp(-st * 6) * np.sign(np.sin(2 * np.pi * root * st)) * 0.5
    # 鼓：底鼓 + 闭镲
    rng = np.random.default_rng(7)
    groove_start = SCENES[1][0]
    for k in range(int(DURATION / beat)):
        bt = k * beat
        if bt < groove_start - 0.01 or bt > DURATION - 3:
            continue
        s = int(bt * SR)
        L = int(0.35 * SR)
        st = np.arange(min(L, n - s)) / SR
        out[s:s + len(st)] += 0.35 * np.sin(2 * np.pi * (50 + 90 * np.exp(-st * 30)) * st) * np.exp(-st * 9)
        hs = int((bt + beat / 2) * SR)
        HL = int(0.06 * SR)
        if hs + HL < n:
            noise = rng.standard_normal(HL)
            noise = np.diff(noise, prepend=0)
            out[hs:hs + HL] += 0.04 * noise * np.exp(-np.arange(HL) / SR * 60)
    # 转场的「嗖」声
    for start, *_ in SCENES[1:]:
        L = int(0.7 * SR)
        s = int((start - 0.45) * SR)
        st = np.arange(L) / SR
        noise = rng.standard_normal(L)
        k = 40
        sm = np.convolve(noise, np.ones(k) / k, mode='same')
        env = np.sin(np.pi * st / 0.7) ** 2
        out[s:s + L] += 0.25 * (noise - sm) * env * 0.4
    fade = np.minimum(1, t / 1.5) * np.minimum(1, (DURATION - t) / 2.5)
    out *= fade
    out = np.tanh(out * 1.2)
    out = out / np.max(np.abs(out)) * 0.6
    stereo = np.stack([out, np.roll(out, 220)], axis=1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((stereo * 32767).astype(np.int16).tobytes())


# ---------- 字幕文件 ----------

def write_srt(path):
    def ts(x):
        ms = int(round(x * 1000))
        return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'
    with open(path, 'w', encoding='utf-8') as f:
        for i, (start, dur, _, cap) in enumerate(SCENES, 1):
            f.write(f'{i}\n{ts(start)} --> {ts(start + dur)}\n{cap}\n\n')


def main():
    work = os.environ.get('WORK_DIR') or os.path.join(OUT_DIR, '.work')
    os.makedirs(work, exist_ok=True)
    if '--preview' in sys.argv:
        for i, (start, dur, *_ ) in enumerate(SCENES):
            Image.frombytes('RGB', (W, H), render(int((start + dur * 0.8) * FPS))).save(os.path.join(work, f'preview-{i}.png'))
        print('preview ->', work)
        return
    audio = os.path.join(work, 'music.wav')
    synth_music(audio)
    out = os.path.join(OUT_DIR, NAME + '.mp4')
    frames = int(DURATION * FPS)
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                           '-r', str(FPS), '-i', '-', '-i', audio, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
                           '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', out],
                          stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for i, buf in enumerate(pool.imap(render, range(frames), chunksize=8)):
            ff.stdin.write(buf)
            if i % 150 == 0:
                print(f'{i}/{frames}', flush=True)
    ff.stdin.close()
    ff.wait()
    write_srt(os.path.join(OUT_DIR, NAME + '.srt'))
    print('done ->', out)


if __name__ == '__main__':
    main()
