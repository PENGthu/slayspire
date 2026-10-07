"""从开源查卡站的数据（Next-Ark-Nova-Cards）生成原版 128 张动物卡的功能数据。
只取规则相关的字段（体型、费用、图标、条件、能力、数值），卡面文字由游戏代码自行生成。
用法：python3 gen_animals.py data.json zh-CN/common.json > src/game/content/animals.ts
"""
import json
import sys

data = json.load(open(sys.argv[1]))
zh = json.load(open(sys.argv[2]))

EMOJI = {
    401: '🐆', 402: '🦁', 403: '🐆', 404: '🐈', 405: '🦊', 406: '🐅', 407: '🐯', 408: '🐻', 409: '🐻', 410: '🦡',
    411: '🐻', 412: '🐆', 413: '🐈', 414: '🦝', 415: '🦝', 416: '🐻', 417: '🐺', 418: '🐈', 419: '🦡', 420: '🦦',
    421: '🦭', 422: '🦭', 423: '🦭', 424: '🐕', 425: '🐾', 426: '🐘', 427: '🦏', 428: '🦒', 429: '🦓', 430: '🦛',
    431: '🐘', 432: '🦏', 433: '🐼', 434: '🦝', 435: '🐗', 436: '🦬', 437: '🐂', 438: '🦌', 439: '🦙', 440: '🐗',
    441: '🦬', 442: '🦌', 443: '🦌', 444: '🐐', 445: '🦔', 446: '🦭', 447: '🦘', 448: '🐨', 449: '🦫', 450: '🐹',
    451: '🐒', 452: '🐵', 453: '🐒', 454: '🐒', 455: '🐒', 456: '🐵', 457: '🐵', 458: '🐵', 459: '🐒', 460: '🐒',
    461: '🐵', 462: '🐒', 463: '🐒', 464: '🐒', 465: '🐵', 466: '🐒', 467: '🐵', 468: '🐵', 469: '🐊', 470: '🐍',
    471: '🐢', 472: '🦎', 473: '🦎', 474: '🐍', 475: '🐍', 476: '🦎', 477: '🦎', 478: '🦎', 479: '🐊', 480: '🐊',
    481: '🐢', 482: '🐍', 483: '🐍', 484: '🐢', 485: '🐍', 486: '🦎', 487: '🐍', 488: '🐍', 489: '🐊', 490: '🦎',
    491: '🦎', 492: '🐍', 493: '🦎', 494: '🐦', 495: '🦅', 496: '🐦', 497: '🦩', 498: '🐦', 499: '🦅', 500: '🦅',
    501: '🦚', 502: '🐦', 503: '🦉', 504: '🦅', 505: '🦅', 506: '🦅', 507: '🐦', 508: '🦜', 509: '🦅', 510: '🐦',
    511: '🦩', 512: '🦉', 513: '🦉', 514: '🐦', 515: '🐦', 516: '🐦', 517: '🐦', 518: '🐦', 519: '🐐', 520: '🐑',
    521: '🐎', 522: '🐴', 523: '🐇', 524: '🐖', 525: '🐹', 526: '🦙', 527: '🦜', 528: '🦘',
}

ACTION_OF = {'Association': 'association', 'Building': 'build', 'Card': 'cards', 'Cards': 'cards', 'Sponsors': 'sponsors', 'Animal': 'animals'}
CONT = {'africa', 'europe', 'asia', 'americas', 'australia'}


def ability(kw, value):
    if kw == 'Sprint':
        return {'k': 'sprint', 'n': int(value)}
    if kw == 'Hunter':
        return {'k': 'hunter', 'n': int(value)}
    if kw == 'Perception 4':
        return {'k': 'perception', 'n': 4, 'keep': 2}
    if kw == 'Snapping 1':
        return {'k': 'snap', 'n': 1}
    if kw == 'Snapping 2':
        return {'k': 'snap', 'n': 2}
    if kw.startswith('Boost: '):
        return {'k': 'boost', 'action': ACTION_OF[kw[7:]]}
    if kw.startswith('Action: '):
        return {'k': 'actionNow', 'action': ACTION_OF[kw[8:]]}
    if kw.startswith('Multiplier: '):
        return {'k': 'multiplier', 'action': ACTION_OF[kw[12:]]}
    if kw == 'Clever':
        return {'k': 'clever'}
    if kw == 'Pack':
        return {'k': 'pack'}
    if kw == 'Iconic Animal':
        return {'k': 'iconic', 'cont': str(value).lower()}
    if kw == 'Pouch':
        return {'k': 'pouch', 'n': int(value)}
    if kw == 'Sun Bathing':
        return {'k': 'sunbathe', 'n': int(value)}
    if kw == 'Venom':
        return {'k': 'venom', 'n': int(value)}
    if kw == 'Constriction':
        return {'k': 'constrict'}
    if kw == 'Hypnosis':
        return {'k': 'hypnosis', 'n': int(value)}
    if kw == 'Jumping':
        return {'k': 'jump', 'n': int(value)}
    if kw == 'Digging':
        return {'k': 'dig', 'n': int(value)}
    if kw == 'Posturing':
        return {'k': 'posture', 'n': int(value)}
    if kw == 'Resistance':
        return {'k': 'resist'}
    if kw == 'Assertion':
        return {'k': 'assert'}
    if kw == 'Dominance':
        return {'k': 'dominance'}
    if kw == 'Scavenging':
        return {'k': 'scavenge', 'n': int(value)}
    if kw == 'Inventive':
        return {'k': 'inventive', 'n': int(value or 1)}
    if kw == 'Inventive: Bear':
        return {'k': 'inventiveBear'}
    if kw == 'Inventive: Primary':
        return {'k': 'inventivePrimate'}
    if kw == 'Full-throated':
        return {'k': 'fullThroated'}
    if kw == 'Flock Animal':
        return {'k': 'flock', 'n': int(value)}
    if kw == 'Sponsor Magnet':
        return {'k': 'sponsorMagnet'}
    if kw == 'Pilfering 1':
        return {'k': 'pilfer', 'n': 1}
    if kw == 'Pilfering 2':
        return {'k': 'pilfer', 'n': 2}
    if kw == 'Determination':
        return {'k': 'determination'}
    if kw == 'Peacocking':
        return {'k': 'peacock'}
    if kw == 'Petting Zoo Animal':
        return {'k': 'petting'}
    raise SystemExit(f'未知能力 {kw}')


def icon(tag):
    t = tag.lower()
    if t == 'pet':
        return 'petting'
    return t


out = []
for a in data['animals']:
    if a['source'] != 'Base':
        continue
    num = int(a['id'])
    reqs = {}
    req_list = []
    for r in a.get('requirements') or []:
        if r == 'Partner Zoo':
            req_list.append({'k': 'partner'})
        elif r == 'animalsII':
            req_list.append({'k': 'upgrade', 'action': 'animals'})
        else:
            reqs[icon(r)] = reqs.get(icon(r), 0) + 1
    for ic, n in reqs.items():
        req_list.insert(0, {'k': 'icon', 'icon': ic, 'n': n})
    rec = {
        'id': f'a{num}',
        'num': num,
        'name': zh[a['name']].strip(),
        'en': a['name'].title(),
        'emoji': EMOJI[num],
        'size': a['size'],
        'cost': a['price'],
        'icons': [icon(t) for t in a['tags']],
        'appeal': a.get('appeal') or 0,
    }
    if a.get('water'):
        rec['water'] = a['water']
    if a.get('rock'):
        rec['rock'] = a['rock']
    if req_list:
        rec['req'] = req_list
    for se in a.get('specialEnclosures') or []:
        kind = {'Petting Zoo': 'petting', 'Reptile House': 'reptile', 'Large Bird Aviary': 'aviary'}[se['type']]
        rec['special'] = {'kind': kind, 'units': se['size']}
    if a.get('canBeInStandardEnclosure') is False:
        rec['noStandard'] = True
    if a.get('conservationPoint'):
        rec['cp'] = a['conservationPoint']
    if a.get('reputation'):
        rec['rep'] = a['reputation']
    abil = [ability(x['keyword']['name'], x.get('value')) for x in a.get('abilities') or []]
    if abil:
        rec['abilities'] = abil
    out.append(rec)

assert len(out) == 128, len(out)
print('// 由 scripts/data/gen_animals.py 生成，请勿手改。')
print('// 原版基础游戏 128 张动物卡的功能数据（体型、费用、图标、条件、能力）；卡面文字由游戏代码生成，插图为表情符号。')
print("import type { AnimalCard } from '../types';")
print()
print('export const ANIMALS: AnimalCard[] = [')
for r in out:
    r = {'kind': 'animal', **r}
    print('  ' + json.dumps(r, ensure_ascii=False) + ',')
print('];')
