import { defineAncients, ENCHANTS, RELICS } from '../registry';
import { canUpgrade, cardDef, makeCard, upgradeCard } from '../cards';
import { curseIds } from '../run';
import type { Run } from '../run';

const removable = (run: Run) => run.deck.filter((c) => c.id !== 'ascenders_bane');

function chooseRemove(run: Run, n: number) {
  run.selectCards({
    title: `选择 ${n} 张牌移除`,
    cards: removable(run),
    min: n,
    max: n,
    onDone: (s) => s.forEach((c) => run.removeCard(c)),
  });
}

function chooseUpgrade(run: Run, n: number) {
  run.selectCards({
    title: `选择 ${n} 张牌升级`,
    cards: run.deck.filter(canUpgrade),
    min: n,
    max: n,
    preview: 'upgrade',
    onDone: (s) => s.forEach(upgradeCard),
  });
}

function chooseTransform(run: Run, n: number, upgrade = false) {
  run.selectCards({
    title: `选择 ${n} 张牌变化${upgrade ? '并升级' : ''}`,
    cards: removable(run),
    min: n,
    max: n,
    onDone: (s) => s.forEach((c) => run.transformCard(c, upgrade)),
  });
}

function chooseRare(run: Run, color: string = run.char) {
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) ids.push(run.randomCardId('rare', color, undefined, ids));
  run.selectCards({
    title: '选择一张稀有牌加入牌组',
    cards: ids.map((id) => makeCard(id)),
    min: 1,
    max: 1,
    onDone: (s) => s.forEach((c) => run.addCard(c, false, true)),
  });
}

function chooseEnchant(run: Run, id: string, n: number, filter: (t: string) => boolean = () => true) {
  const e = ENCHANTS[id];
  run.selectCards({
    title: `选择一张牌附魔「${e.name}」`,
    cards: run.deck.filter((c) => !c.ench && e.fits(cardDef(c)) && filter(cardDef(c).type)),
    min: 1,
    max: 1,
    onDone: (s) => s.forEach((c) => run.enchant(c, id, n)),
  });
}

function fillPotions(run: Run, n: number, rarity?: 'common' | 'uncommon' | 'rare') {
  for (let i = 0; i < n; i++) if (!run.obtainPotion(run.randomPotionId(rarity))) break;
}

defineAncients([
  {
    id: 'neow',
    name: '涅奥',
    title: '尖塔的守望者',
    art: '🐋',
    color: '#5fb3c8',
    acts: [1],
    intro: '「又一位攀登者……」一个古老而疲惫的声音在你脑海中响起。「拿去吧，愿它能让你走得更远一些。」',
    blessings: [
      { id: 'maxhp', label: '坚韧之躯', desc: '最大生命 +8。', apply: (r) => r.gainMaxHp(8) },
      { id: 'gold', label: '旅费', desc: '获得 100 金币。', apply: (r) => r.gainGold(100) },
      { id: 'remove', label: '轻装上阵', desc: '从牌组中移除一张牌。', apply: (r) => chooseRemove(r, 1) },
      { id: 'upgrade', label: '磨砺', desc: '升级一张牌。', apply: (r) => chooseUpgrade(r, 1) },
      { id: 'transform', label: '蜕变', desc: '变化一张牌。', apply: (r) => chooseTransform(r, 1) },
      { id: 'rare', label: '天赋', desc: '从 3 张稀有牌中选择 1 张加入牌组。', apply: (r) => chooseRare(r) },
      { id: 'relic', label: '旧物', desc: '获得一件随机普通遗物。', apply: (r) => r.obtainRelic(r.randomRelicId('common')) },
      { id: 'potions', label: '补给', desc: '获得 3 瓶随机药水。', apply: (r) => fillPotions(r, 3) },
      { id: 'sharp', label: '锋锐之刃', desc: '为一张攻击牌附魔「锋锐 3」。', apply: (r) => chooseEnchant(r, 'sharp', 3) },
      { id: 'lament', label: '涅奥的悲恸', desc: '接下来 3 场战斗中，敌人的生命变为 1。', apply: (r) => r.obtainRelic('neows_lament') },
      {
        id: 't_relic', label: '以血换宝', tone: 'trade', desc: '失去 10% 最大生命，获得一件随机稀有遗物。',
        apply: (r) => {
          r.loseMaxHp(Math.floor(r.maxHp * 0.1));
          r.obtainRelic(r.randomRelicId('rare'));
        },
      },
      {
        id: 't_gold', label: '受诅的财富', tone: 'trade', desc: '获得一张随机诅咒，获得 250 金币。',
        apply: (r) => {
          r.addCard(r.rng('event').pick(curseIds()));
          r.gainGold(250);
        },
      },
      {
        id: 't_purge', label: '倾囊', tone: 'trade', desc: '失去所有金币，移除 2 张牌。',
        apply: (r) => {
          r.loseGold(r.gold);
          chooseRemove(r, 2);
        },
      },
      {
        id: 't_rare2', label: '浴血天赋', tone: 'trade', desc: '失去 30% 当前生命，从 3 张稀有牌中选择 1 张，并获得一件普通遗物。',
        apply: (r) => {
          r.damage(Math.floor(r.hp * 0.3));
          r.obtainRelic(r.randomRelicId('common'));
          chooseRare(r);
        },
      },
    ],
  },
  {
    id: 'orobas',
    name: '奥罗巴斯',
    title: '蜕变之主',
    art: '🦋',
    color: '#7f8cf0',
    acts: [2, 3],
    intro: '一只由无数碎片组成的巨大生物缓缓展开翅膀。「万物终将改变。你想变成什么？」',
    blessings: [
      { id: 'transform2', label: '重塑', desc: '选择 2 张牌变化并升级。', apply: (r) => chooseTransform(r, 2, true) },
      { id: 'prism', label: '奥罗巴斯棱镜', desc: '获得遗物：每场战斗开始时，将一张随机升级过的稀有牌加入手牌，本回合费用为 0。', apply: (r) => r.obtainRelic('orobas_prism') },
      { id: 'echo', label: '回响', desc: '为一张牌附魔「回响」（每场战斗首次打出时额外打出一次）。', apply: (r) => chooseEnchant(r, 'echo', 1) },
      { id: 'upgrade3', label: '升华', desc: '随机升级 4 张牌。', apply: (r) => void r.upgradeRandom(4) },
      {
        id: 't_pandora', label: '彻底蜕变', tone: 'trade', desc: '变化牌组中所有的初始打击和防御。',
        cond: (r) => r.deck.some((c) => cardDef(c).tags?.includes('starter')),
        apply: (r) => {
          for (const c of r.deck.filter((x) => cardDef(x).tags?.includes('starter'))) r.transformCard(c);
        },
      },
      {
        id: 't_colorless', label: '异界之形', tone: 'trade', desc: '失去 8 点最大生命，从 3 张无色稀有牌中选择 1 张。',
        apply: (r) => {
          r.loseMaxHp(8);
          chooseRare(r, 'colorless');
        },
      },
    ],
  },
  {
    id: 'pael',
    name: '帕埃尔',
    title: '血肉之主',
    art: '👁️',
    color: '#d0534f',
    acts: [2, 3],
    intro: '一只巨大的眼睛从血肉之墙中睁开。「强大的躯体，强大的意志。我可以给你……更多。」',
    blessings: [
      { id: 'flesh', label: '血肉之赐', desc: '最大生命 +12。', apply: (r) => r.gainMaxHp(12) },
      { id: 'eye', label: '帕埃尔之眼', desc: '获得遗物：每场战斗开始时获得 2 点力量和 2 点敏捷，但失去 4 点生命。', apply: (r) => r.obtainRelic('pael_eye') },
      { id: 'purge', label: '剔除', desc: '移除 2 张牌。', apply: (r) => chooseRemove(r, 2) },
      {
        id: 't_relics', label: '血肉交换', tone: 'trade', desc: '失去 15 点最大生命，获得 2 件随机遗物。',
        apply: (r) => {
          r.loseMaxHp(15);
          r.obtainRelic(r.randomRelicId());
          r.obtainRelic(r.randomRelicId());
        },
      },
      {
        id: 't_strength', label: '暴虐之血', tone: 'trade', desc: '获得诅咒「受伤」，为两张攻击牌附魔「锋锐 4」。',
        apply: (r) => {
          r.addCard('injury');
          chooseEnchant(r, 'sharp', 4);
          const second = r.deck.filter((c) => !c.ench && ENCHANTS.sharp.fits(cardDef(c)));
          if (second.length) r.enchant(r.rng('event').pick(second), 'sharp', 4);
        },
      },
    ],
  },
  {
    id: 'tezcatara',
    name: '特兹卡塔拉',
    title: '炉火之母',
    art: '🔥',
    color: '#f0913c',
    acts: [2, 3],
    intro: '温暖的火焰中浮现出一位女性的轮廓。「歇一歇吧，孩子。炉火会照看你。」',
    blessings: [
      { id: 'hearth', label: '炉边小憩', desc: '最大生命 +5，并回复所有生命。', apply: (r) => { r.gainMaxHp(5); r.heal(r.maxHp); } },
      { id: 'temper', label: '淬火', desc: '升级 2 张牌。', apply: (r) => chooseUpgrade(r, 2) },
      { id: 'brew', label: '炉火药剂', desc: '获得 2 瓶稀有药水。', apply: (r) => fillPotions(r, 2, 'rare') },
      { id: 'vigor', label: '充沛', desc: '为一张牌附魔「充沛」（每场战斗首次打出时获得 1 点能量）。', apply: (r) => chooseEnchant(r, 'vigorous', 1) },
      {
        id: 't_ember', label: '余烬之心', tone: 'trade', desc: '获得遗物「特兹卡塔拉的余烬」：每回合 +1 能量，但每场战斗开始时失去 6 点生命。',
        apply: (r) => r.obtainRelic('tezcatara_ember'),
      },
    ],
  },
  {
    id: 'nonupeipe',
    name: '诺努佩佩',
    title: '财富之灵',
    art: '🪙',
    color: '#e5c454',
    acts: [2, 3],
    intro: '一个由金币堆成的小家伙蹦蹦跳跳地凑过来。「叮叮当当！你喜欢闪闪发光的东西吗？」',
    blessings: [
      { id: 'gold', label: '金币雨', desc: '获得 200 金币。', apply: (r) => r.gainGold(200) },
      { id: 'purse', label: '诺努佩佩的钱袋', desc: '获得遗物：战斗获得的金币翻倍。', apply: (r) => r.obtainRelic('nonupeipe_purse') },
      { id: 'shop', label: '珍藏品', desc: '获得一件商店遗物。', apply: (r) => r.obtainRelic(r.randomRelicId('shop')) },
      {
        id: 't_invest', label: '孤注一掷', tone: 'trade', desc: '失去所有金币，获得一件稀有遗物和一件罕见遗物。',
        apply: (r) => {
          r.loseGold(r.gold);
          r.obtainRelic(r.randomRelicId('rare'));
          r.obtainRelic(r.randomRelicId('uncommon'));
        },
      },
    ],
  },
  {
    id: 'vakuu',
    name: '瓦库',
    title: '混沌之眼',
    art: '🎭',
    color: '#a65fd0',
    acts: [2, 3],
    intro: '一张面具悬浮在虚空中，不停地变换着表情。「哈哈！让我们来玩个游戏吧！」',
    blessings: [
      { id: 'mask', label: '瓦库的面具', desc: '获得遗物：每场战斗开始时，随机给予一名敌人 3 层易伤和 3 层虚弱。', apply: (r) => r.obtainRelic('vakuu_mask') },
      {
        id: 'chaos_enchant', label: '混沌附魔', desc: '随机为 2 张牌附魔随机效果。',
        apply: (r) => {
          const rng = r.rng('event');
          for (let i = 0; i < 2; i++) {
            const ids = Object.keys(ENCHANTS);
            const id = rng.pick(ids);
            const cands = r.deck.filter((c) => !c.ench && ENCHANTS[id].fits(cardDef(c)));
            if (cands.length) r.enchant(rng.pick(cands), id, id === 'sharp' || id === 'sturdy' ? 3 : id === 'guarded' ? 4 : id === 'venom' ? 2 : 1);
          }
        },
      },
      { id: 'colorless', label: '奇妙戏法', desc: '从 3 张无色稀有牌中选择 1 张。', apply: (r) => chooseRare(r, 'colorless') },
      {
        id: 't_boss', label: '危险的赌注', tone: 'trade', desc: '获得诅咒「疼痛」，获得一件随机首领遗物。',
        apply: (r) => {
          r.addCard('pain');
          r.obtainRelic(r.randomRelicId('boss'));
        },
      },
    ],
  },
  {
    id: 'darv',
    name: '达尔夫',
    title: '遗物收藏家',
    art: '🏺',
    color: '#c9a36b',
    acts: [2, 3],
    intro: '一个满身挂着古董的老者从阴影中走出。「我收藏了许多有趣的东西……也许你会喜欢其中一件。」',
    blessings: [
      { id: 'uncommon', label: '收藏品', desc: '获得一件随机罕见遗物。', apply: (r) => r.obtainRelic(r.randomRelicId('uncommon')) },
      { id: 'pair', label: '一对小玩意', desc: '获得 2 件随机普通遗物。', apply: (r) => { r.obtainRelic(r.randomRelicId('common')); r.obtainRelic(r.randomRelicId('common')); } },
      { id: 'potions', label: '药剂柜', desc: '用随机药水填满药水栏。', apply: (r) => fillPotions(r, 5) },
      {
        id: 't_swap', label: '以旧换新', tone: 'trade', desc: '失去一件随机遗物（非初始），获得一件稀有遗物和一件罕见遗物。',
        cond: (r) => r.relics.some((x) => RELICS[x.id]?.tier !== 'starter'),
        apply: (r) => {
          const cands = r.relics.filter((x) => RELICS[x.id]?.tier !== 'starter');
          if (cands.length) r.loseRelic(r.rng('event').pick(cands).id);
          r.obtainRelic(r.randomRelicId('rare'));
          r.obtainRelic(r.randomRelicId('uncommon'));
        },
      },
    ],
  },
]);
