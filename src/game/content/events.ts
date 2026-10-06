import { defineCards, defineEvents, ENCHANTS } from '../registry';
import { canUpgrade, cardDef, cardDmg, makeCard, upgradeCard } from '../cards';
import type { Run } from '../run';
import type { EventOption, EventState } from '../events';

const leave = (run: Run): EventOption => ({ label: '离开', go: () => run.leaveRoom() });
const done = (ev: EventState, note: string) => {
  ev.page = 'done';
  ev.note = note;
};
const doneView = (run: Run, ev: EventState) => ({ text: ev.note ?? '', options: [leave(run)] });

const removable = (run: Run) => run.deck.filter((c) => c.id !== 'ascenders_bane');
const enchantable = (run: Run, id: string) => run.deck.filter((c) => !c.ench && ENCHANTS[id].fits(cardDef(c)));

defineEvents([
  // =========================================================== 第一幕
  {
    id: 'big_fish', name: '大鱼', art: '🐟', acts: [1],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '你在溪边发现一条巨大的鱼，它的嘴里叼着三样东西：一根香蕉、一个甜甜圈，还有一个闪闪发光的盒子。它似乎愿意让你拿走其中一样。',
        options: [
          { label: '香蕉', hint: `回复 ${Math.floor(run.maxHp / 3)} 点生命`, tone: 'good', go: () => {
            run.heal(Math.floor(run.maxHp / 3));
            done(ev, '香蕉意外地美味。你感觉好多了。');
          } },
          { label: '甜甜圈', hint: '最大生命 +5', tone: 'good', go: () => {
            run.gainMaxHp(5);
            done(ev, '甜甜圈让你充满了活力。');
          } },
          { label: '盒子', hint: '获得一件遗物，获得一张诅咒「悔恨」', tone: 'bad', go: () => {
            run.obtainRelic(run.randomRelicId());
            run.addCard('regret');
            done(ev, '盒子里有件宝物……但打开它的那一刻，一阵悔意涌上心头。');
          } },
        ],
      };
    },
  },
  {
    id: 'golden_shrine', name: '金色神龛', art: '⛩️', acts: [1, 2],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '藤蔓之间藏着一座古老的金色神龛，神龛前的碗里堆满了供奉的金币。',
        options: [
          { label: '祈祷', hint: '获得 100 金币', tone: 'good', go: () => {
            run.gainGold(100);
            done(ev, '一阵温暖的光芒落下，碗里的金币落入了你的口袋。');
          } },
          { label: '亵渎', hint: '获得 275 金币，获得一张诅咒「悔恨」', tone: 'bad', go: () => {
            run.gainGold(275);
            run.addCard('regret');
            done(ev, '你把金币一扫而空。神龛的光芒熄灭了，某种东西缠上了你。');
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'cleansing_spring', name: '净化之泉', art: '⛲', acts: [1, 2, 3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '清澈的泉水从石缝中涌出。据说在这里洗去的东西，再也不会回来。',
        options: [
          { label: '净化', hint: '从牌组中移除一张牌', tone: 'good', go: () =>
            run.selectCards({
              title: '选择一张牌移除',
              cards: removable(run),
              min: 1,
              max: 1,
              onDone: (s) => {
                s.forEach((c) => run.removeCard(c));
                done(ev, `「${s[0] ? cardDef(s[0]).name : ''}」随泉水而去。`);
              },
            }) },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'upgrade_shrine', name: '锻造神龛', art: '⚒️', acts: [1, 2, 3],
    cond: (run) => run.deck.some(canUpgrade),
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一座布满火痕的铁砧立在空地中央，余温未散。',
        options: [
          { label: '锻造', hint: '升级一张牌', tone: 'good', go: () =>
            run.selectCards({
              title: '选择一张牌升级',
              cards: run.deck.filter(canUpgrade),
              min: 1,
              max: 1,
              preview: 'upgrade',
              onDone: (s) => {
                s.forEach(upgradeCard);
                done(ev, '铁锤落下，火花四溅。');
              },
            }) },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'transmogrifier', name: '变化神龛', art: '🌀', acts: [1, 2, 3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一团扭曲的光雾悬浮在空中，所有靠近它的东西都在不断变化形态。',
        options: [
          { label: '投入', hint: '变化一张牌', tone: 'neutral', go: () =>
            run.selectCards({
              title: '选择一张牌变化',
              cards: removable(run),
              min: 1,
              max: 1,
              onDone: (s) => {
                const nc = s[0] ? run.transformCard(s[0]) : null;
                done(ev, nc ? `它变成了「${cardDef(nc).name}」。` : '什么也没发生。');
              },
            }) },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'mushrooms', name: '迷幻蘑菇', art: '🍄', acts: [1],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一圈色彩斑斓的蘑菇围成了完美的圆环。圆环上空，一只飞行菌菇扇着菌褶，两只史莱姆正在啃食蘑菇。',
        options: [
          { label: '踩踏', hint: '与蘑菇战斗，获胜后获得一件遗物「怪蘑菇」', tone: 'bad', go: () =>
            run.startEventCombat(['leaf_slime_s', 'flyconid', 'twig_slime_s'], { relic: run.hasRelic('odd_mushroom') ? undefined : 'odd_mushroom' }) },
          { label: '品尝', hint: `回复 ${Math.floor(run.maxHp * 0.25)} 点生命，获得诅咒「寄生虫」`, tone: 'bad', go: () => {
            run.heal(Math.floor(run.maxHp * 0.25));
            run.addCard('parasite');
            done(ev, '蘑菇的味道很奇怪……你感觉体内有什么在蠕动。');
          } },
        ],
      };
    },
  },
  {
    id: 'scrap_ooze', name: '废料软泥', art: '🫠', acts: [1],
    init: (_run, ev) => {
      ev.vars.dmg = 3;
      ev.vars.chance = 25;
    },
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: `一团软泥里闪着金属的光泽，似乎吞下了什么宝物。伸手进去会被腐蚀……${ev.note ?? ''}`,
        options: [
          { label: '伸手摸索', hint: `失去 ${ev.vars.dmg} 点生命，${ev.vars.chance}% 几率找到遗物`, tone: 'bad', go: () => {
            run.damage(ev.vars.dmg);
            if (run.dead) return;
            if (run.rng('event').int(0, 99) < ev.vars.chance) {
              run.obtainRelic(run.randomRelicId());
              done(ev, '你摸到了一件遗物！');
            } else {
              ev.vars.dmg += 1;
              ev.vars.chance += 10;
              ev.note = '\n\n什么也没摸到。';
            }
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'wheel_of_fate', name: '命运之轮', art: '🎡', acts: [1, 2, 3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一个戴着面具的侏儒站在巨大的轮盘旁边：「转一转吧，旅人！命运从不亏待勇者……大概。」',
        options: [
          { label: '转动轮盘', hint: '随机获得金币、遗物、治疗、诅咒、移除卡牌或受到伤害', tone: 'neutral', go: () => {
            const r = run.rng('event').int(0, 5);
            if (r === 0) {
              const g = run.act * 100;
              run.gainGold(g);
              done(ev, `金币！你获得了 ${g} 金币。`);
            } else if (r === 1) {
              run.obtainRelic(run.randomRelicId());
              done(ev, '一件遗物从轮盘中弹了出来。');
            } else if (r === 2) {
              run.heal(run.maxHp);
              done(ev, '一阵暖流涌遍全身，你的生命完全恢复了。');
            } else if (r === 3) {
              run.addCard('decay');
              done(ev, '轮盘停在了骷髅上。你获得了诅咒「腐朽」。');
            } else if (r === 4) {
              run.selectCards({
                title: '选择一张牌移除',
                cards: removable(run),
                min: 1,
                max: 1,
                onDone: (s) => {
                  s.forEach((c) => run.removeCard(c));
                  done(ev, '轮盘吞掉了你的一张牌。');
                },
              });
            } else {
              const d = Math.floor(run.maxHp * 0.1);
              run.damage(d);
              done(ev, `轮盘飞出一把刀，你失去了 ${d} 点生命。`);
            }
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'enchanter', name: '附魔祭坛', art: '🔮', acts: [1, 2, 3],
    init: (run, ev) => {
      const ids = Object.keys(ENCHANTS).filter((id) => enchantable(run, id).length > 0);
      const rng = run.rng('event');
      const pick = rng.sample(ids, 2);
      ev.vars.a = Object.keys(ENCHANTS).indexOf(pick[0] ?? 'sharp');
      ev.vars.b = Object.keys(ENCHANTS).indexOf(pick[1] ?? 'sturdy');
    },
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      const keys = Object.keys(ENCHANTS);
      const opts: EventOption[] = [ev.vars.a, ev.vars.b].map((i, k) => {
        const id = keys[i];
        const e = ENCHANTS[id];
        const n = id === 'sharp' ? 3 : id === 'sturdy' ? 3 : id === 'guarded' ? 4 : id === 'venom' ? 2 : 1;
        const cost = k === 0 ? 40 : 0;
        const hpCost = k === 1 ? 6 : 0;
        return {
          label: `${e.name}${n > 1 ? ' ' + n : ''}`,
          hint: `${e.desc(n)}${cost ? `（花费 ${cost} 金币）` : `（失去 ${hpCost} 点生命）`}`,
          disabled: cost > run.gold ? '金币不足' : enchantable(run, id).length === 0 ? '没有可附魔的牌' : false,
          tone: 'good',
          go: () =>
            run.selectCards({
              title: `选择一张牌附魔「${e.name}」`,
              cards: enchantable(run, id),
              min: 1,
              max: 1,
              canCancel: true,
              onDone: (s) => {
                if (!s[0]) return;
                if (cost) run.loseGold(cost);
                if (hpCost) run.damage(hpCost);
                run.enchant(s[0], id, n);
                done(ev, `「${cardDef(s[0]).name}」获得了「${e.name}」附魔，散发出微光。`);
              },
            }),
        };
      });
      return {
        text: '石台上刻满了发光的符文。一位蒙面的附魔师低声说道：「我可以让你的招式变得更加……独特。当然，要付出代价。」',
        options: [...opts, leave(run)],
      };
    },
  },
  {
    id: 'wandering_merchant', name: '流浪商人', art: '🧳', acts: [1, 2],
    cond: (run) => run.gold >= 50,
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一个背着巨大背包的商人拦住了你：「神秘礼盒，只要 50 金币！保证物超所值！」',
        options: [
          { label: '购买', hint: '花费 50 金币，获得一件随机物品', disabled: run.gold < 50 ? '金币不足' : false, go: () => {
            run.loseGold(50);
            const r = run.rng('event').int(0, 2);
            if (r === 0) {
              run.obtainRelic(run.randomRelicId('common'));
              done(ev, '礼盒里是一件遗物！');
            } else if (r === 1) {
              const c = makeCard(run.randomCardId('rare'));
              run.addCard(c);
              done(ev, `礼盒里是一张稀有牌「${cardDef(c).name}」。`);
            } else {
              const ok = run.obtainPotion(run.randomPotionId('rare'));
              done(ev, ok ? '礼盒里是一瓶稀有药水。' : '礼盒里是一瓶药水，但你的药水栏已满，只好丢掉了。');
            }
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'lost_traveler', name: '迷途的旅人', art: '🧭', acts: [1, 2],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一个受伤的旅人靠在树下，紧紧抱着一个包裹：「求你……帮帮我……」',
        options: [
          { label: '帮助', hint: '失去 8 点生命，获得一张随机升级牌', tone: 'neutral', go: () => {
            run.damage(8);
            if (run.dead) return;
            const c = makeCard(run.randomCardId(run.rollRarity('elite')), true);
            run.addCard(c);
            done(ev, `旅人感激地把包裹交给了你。里面是「${cardDef(c).name}+」。`);
          } },
          { label: '抢夺', hint: '获得 60 金币，获得诅咒「羞耻」', tone: 'bad', go: () => {
            run.gainGold(60);
            run.addCard('shame');
            done(ev, '你夺走了他的钱袋。他的眼神一直在你脑海中挥之不去。');
          } },
          leave(run),
        ],
      };
    },
  },
  // =========================================================== 地下船坞
  {
    id: 'shipwreck', name: '沉船残骸', art: '🚢', acts: [1], zones: ['underdocks'],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一艘半沉的货船卡在礁石之间，船舱里隐约有金属的反光。海水冰冷刺骨。',
        options: [
          { label: '潜入船舱', hint: '失去 8 点生命，50% 几率找到遗物，否则获得 60 金币', tone: 'neutral', go: () => {
            run.damage(8);
            if (run.dead) return;
            if (run.rng('event').chance(0.5)) {
              run.obtainRelic(run.randomRelicId());
              done(ev, '你在船长室的保险箱里找到了一件遗物。');
            } else {
              run.gainGold(60);
              done(ev, '你只摸到了一袋湿透的金币。');
            }
          } },
          { label: '打捞货箱', hint: '获得 40 金币和一瓶随机药水', tone: 'good', go: () => {
            run.gainGold(40);
            const ok = run.obtainPotion(run.randomPotionId());
            done(ev, ok ? '货箱里有些金币和一瓶药水。' : '货箱里有些金币，还有一瓶药水，但你已经拿不下了。');
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'smuggler', name: '走私者', art: '🏴', acts: [1], zones: ['underdocks'],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '码头的阴影里，一个独眼的走私者掀开斗篷：「看看这些好货？保证没人知道是从哪儿来的。」',
        options: [
          { label: '购买违禁品', hint: '花费 120 金币，获得一件随机罕见遗物', disabled: run.gold < 120 ? '金币不足' : false, tone: 'good', go: () => {
            run.loseGold(120);
            run.obtainRelic(run.randomRelicId('uncommon'));
            done(ev, '走私者把东西塞进你怀里，转身消失在雾中。');
          } },
          { label: '揭发他', hint: '与走私者一伙战斗，获胜后获得金币', tone: 'bad', go: () =>
            run.startEventCombat(['two_tailed_rat', 'gremlin_merc'], { gold: 60 }) },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'tide_pool', name: '潮池', art: '🐚', acts: [1], zones: ['underdocks'],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '退潮后留下一汪清澈的潮池。池底的贝壳闪烁着柔和的光，一只下水道巨蛤和一只蝌蚪蟾在旁边虎视眈眈。',
        options: [
          { label: '静坐冥想', hint: `回复 ${Math.floor(run.maxHp * 0.2)} 点生命，随机升级 1 张牌`, tone: 'good', go: () => {
            run.heal(Math.floor(run.maxHp * 0.2));
            const up = run.upgradeRandom(1);
            done(ev, up[0] ? `潮声让你平静下来。「${cardDef(up[0]).name}」得到了升级。` : '潮声让你平静下来。');
          } },
          { label: '捡拾发光的贝壳', hint: '与巨蛤和蝌蚪蟾战斗，获胜后获得一件遗物', tone: 'bad', go: () =>
            run.startEventCombat(['toadpole', 'sewer_clam'], { relic: run.randomRelicId() }) },
          leave(run),
        ],
      };
    },
  },
  // =========================================================== 第二幕
  {
    id: 'honey_pot', name: '蜂蜜罐', art: '🍯', acts: [2],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '巨大的蜂巢中滴下金色的蜂蜜，四周却安静得出奇。',
        options: [
          { label: '舔食蜂蜜', hint: `回复 ${Math.floor(run.maxHp * 0.3)} 点生命，最大生命 +3`, tone: 'good', go: () => {
            run.gainMaxHp(3);
            run.heal(Math.floor(run.maxHp * 0.3));
            done(ev, '蜂蜜甘甜无比。');
          } },
          { label: '捣毁蜂巢', hint: '与蜜碗虫战斗，获胜后获得一件遗物', tone: 'bad', go: () =>
            run.startEventCombat(['bowlbug_nectar', 'bowlbug_egg', 'bowlbug_nectar'], { relic: run.randomRelicId() }) },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'masked_bandits', name: '蒙面强盗', art: '🥷', acts: [2],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '三个蒙面强盗从阴影中跳出：「把金币都交出来，不然……」',
        options: [
          { label: '交出金币', hint: `失去全部 ${run.gold} 金币`, tone: 'bad', go: () => {
            run.loseGold(run.gold);
            done(ev, '强盗们拿着钱袋大笑着离开了。');
          } },
          { label: '战斗', hint: '与强盗战斗，获胜后获得一件遗物和金币', tone: 'neutral', go: () =>
            run.startEventCombat(['thieving_hopper', 'axebot', 'thieving_hopper'], { relic: run.randomRelicId(), gold: 40 }) },
        ],
      };
    },
  },
  {
    id: 'knowing_skull', name: '知晓头骨', art: '💀', acts: [2],
    init: (_run, ev) => (ev.vars.cost = 6),
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      const c = ev.vars.cost;
      return {
        text: `一颗悬浮的头骨低语：「以你的血为代价，我将满足你的愿望。」${ev.note ?? ''}`,
        options: [
          { label: '财富', hint: `失去 ${c} 点生命，获得 90 金币`, tone: 'neutral', go: () => {
            run.damage(c);
            run.gainGold(90);
            ev.vars.cost += 2;
            ev.note = '\n\n金币从头骨的眼眶中流出。';
          } },
          { label: '知识', hint: `失去 ${c} 点生命，获得一张随机无色牌`, tone: 'neutral', go: () => {
            run.damage(c);
            run.addCard(makeCard(run.randomCardId('uncommon', 'colorless')));
            ev.vars.cost += 2;
            ev.note = '\n\n一张发光的卡牌出现在你手中。';
          } },
          { label: '药水', hint: `失去 ${c} 点生命，获得一瓶随机药水`, disabled: run.potionSlotsFree === 0 ? '药水栏已满' : false, tone: 'neutral', go: () => {
            run.damage(c);
            run.obtainPotion(run.randomPotionId());
            ev.vars.cost += 2;
            ev.note = '\n\n一瓶药水凭空出现。';
          } },
          { label: '离开', hint: '失去 6 点生命', go: () => {
            run.damage(6);
            if (!run.dead) run.leaveRoom();
          } },
        ],
      };
    },
  },
  {
    id: 'duplicator', name: '复制之镜', art: '🪞', acts: [2, 3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一面古老的镜子映出你的身影，但镜中的你手里多拿了一张牌。',
        options: [
          { label: '触摸镜面', hint: '复制牌组中的一张牌', tone: 'good', go: () =>
            run.selectCards({
              title: '选择一张牌复制',
              cards: run.deck.filter((c) => cardDef(c).type !== 'curse'),
              min: 1,
              max: 1,
              onDone: (s) => {
                const c = s[0];
                if (c) run.addCard({ ...makeCard(c.id, c.up), ench: c.ench ? { ...c.ench } : undefined, misc: c.misc }, false, true);
                done(ev, '镜中的你点了点头，把牌递给了你。');
              },
            }) },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'forgotten_altar', name: '遗忘祭坛', art: '🗿', acts: [2],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一座布满血迹的祭坛上摆着一尊金色神像。拿走它的话，祭坛恐怕会要求等价的交换。',
        options: [
          { label: '拿走神像', hint: '获得遗物「金色神像」，失去 25% 最大生命', tone: 'bad', disabled: run.hasRelic('golden_idol') ? '已拥有' : false, go: () => {
            run.obtainRelic('golden_idol');
            run.loseMaxHp(Math.floor(run.maxHp * 0.25));
            done(ev, '你拿起神像的瞬间，一股寒意抽走了你的部分生命。');
          } },
          { label: '献祭鲜血', hint: '失去 10 点生命，最大生命 +6', tone: 'neutral', go: () => {
            run.damage(10);
            if (!run.dead) run.gainMaxHp(6);
            done(ev, '祭坛吸收了你的血，回馈给你更强韧的身体。');
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'library', name: '蜂巢图书馆', art: '📚', acts: [2, 3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '蜂蜡筑成的书架上堆满了古书，一位老学者正在打盹。',
        options: [
          { label: '阅读', hint: '从 4 张牌中选择 1 张加入牌组', tone: 'good', go: () => {
            const ids: string[] = [];
            for (let i = 0; i < 4; i++) ids.push(run.randomCardId(run.rollRarity('elite'), run.char, undefined, ids));
            run.selectCards({
              title: '选择一张牌加入牌组',
              cards: ids.map((id) => makeCard(id)),
              min: 1,
              max: 1,
              onDone: (s) => {
                s.forEach((c) => run.addCard(c, false, true));
                done(ev, '你从书中领悟了新的技巧。');
              },
            });
          } },
          { label: '小憩', hint: `回复 ${Math.floor(run.maxHp * 0.33)} 点生命`, tone: 'good', go: () => {
            run.heal(Math.floor(run.maxHp * 0.33));
            done(ev, '你在书堆旁睡了一个好觉。');
          } },
        ],
      };
    },
  },
  // =========================================================== 第三幕
  {
    id: 'mind_bloom', name: '心灵绽放', art: '🌸', acts: [3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '你的意识突然被拉入一片花海。一个声音问道：「你渴望什么？」',
        options: [
          { label: '我渴望力量', hint: '与一名第一幕首领战斗，获胜后获得一件稀有遗物', tone: 'bad', go: () =>
            run.startEventCombat([run.rng('event').pick(['ceremonial_beast', 'vantom'])], { relic: run.randomRelicId('rare'), elite: true }) },
          { label: '我渴望成长', hint: '升级所有牌，获得诅咒「疑虑」', tone: 'neutral', go: () => {
            run.deck.forEach(upgradeCard);
            run.addCard('doubt');
            done(ev, '无数的领悟涌入你的脑海，但一丝疑虑也随之而来。');
          } },
          { label: '我渴望财富', hint: '获得 999 金币，获得 2 张诅咒「凡庸」', tone: 'bad', go: () => {
            run.gainGold(999);
            run.addCard('normality');
            run.addCard('normality');
            done(ev, '金币如雨落下，但你的动作变得迟缓而平庸。');
          } },
        ],
      };
    },
  },
  {
    id: 'falling_star', name: '坠落之星', art: '🌠', acts: [3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一颗星辰坠落在你面前，散发出炫目的光芒与灼热。',
        options: [
          { label: '拥抱星光', hint: '随机升级 3 张牌，失去 10 点生命', tone: 'neutral', go: () => {
            run.damage(10);
            if (run.dead) return;
            run.upgradeRandom(3);
            done(ev, '星辰的力量烙印在你的技艺上。');
          } },
          { label: '收集星尘', hint: '获得一瓶稀有药水和 50 金币', tone: 'good', go: () => {
            run.obtainPotion(run.randomPotionId('rare'));
            run.gainGold(50);
            done(ev, '你小心地收集了星尘。');
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'secret_portal', name: '秘密传送门', art: '🌌', acts: [3],
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一道闪烁的传送门在空中打开。门后传来强大的气息……似乎通往这一层的尽头。',
        options: [
          { label: '进入', hint: '直接前往首领房间', tone: 'bad', go: () => {
            run.pos = { row: 14, col: run.pos?.col ?? 3 };
            run.screen = { s: 'map' };
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'cursed_tome', name: '诅咒之书', art: '📕', acts: [2, 3],
    init: (_run, ev) => (ev.vars.page = 0),
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      const costs = [1, 2, 3, 10];
      const p = ev.vars.page;
      if (p >= 4) {
        return {
          text: '书的最后一页写着一个名字，书页化为灰烬，留下一件遗物。',
          options: [
            { label: '拿走', go: () => {
              run.obtainRelic(run.randomRelicId('rare'));
              done(ev, '你得到了书中封印的宝物。');
            } },
          ],
        };
      }
      return {
        text: p === 0 ? '一本厚重的古书摊开在石台上，书页上的文字似乎在蠕动。' : `你翻到了第 ${p + 1} 页。文字灼烧着你的眼睛。`,
        options: [
          { label: p === 0 ? '阅读' : '继续阅读', hint: `失去 ${costs[p]} 点生命`, tone: 'bad', go: () => {
            run.damage(costs[p]);
            ev.vars.page++;
          } },
          leave(run),
        ],
      };
    },
  },
  {
    id: 'vampires', name: '吸血鬼', art: '🧛', acts: [2],
    cond: (run) => run.deck.some((c) => cardDef(c).tags?.includes('strike') && cardDef(c).tags?.includes('starter')),
    view: (run, ev) => {
      if (ev.page === 'done') return doneView(run, ev);
      return {
        text: '一群披着斗篷的身影围住了你：「加入我们吧，兄弟。你将获得永生……只需放下你那些粗糙的打击。」',
        options: [
          { label: '接受', hint: '移除所有初始打击，加入 5 张「咬噬」，失去 30% 最大生命', tone: 'bad', go: () => {
            for (const c of run.deck.filter((x) => cardDef(x).tags?.includes('strike') && cardDef(x).tags?.includes('starter'))) run.removeCard(c);
            for (let i = 0; i < 5; i++) run.addCard('bite');
            run.loseMaxHp(Math.floor(run.maxHp * 0.3));
            done(ev, '獠牙从你的口中长出。');
          } },
          leave(run),
        ],
      };
    },
  },
]);

// 吸血鬼事件的特殊牌
defineCards([
  {
    id: 'bite', name: '咬噬', color: 'colorless', type: 'attack', rarity: 'special', cost: 1, target: 'enemy',
    dmg: [7, 8], mag: [2, 3], noPool: true, text: '造成 {D} 点伤害。\n回复 {M} 点生命。', art: '🧛', tags: ['healing'],
    play: (g, c, t) => {
      g.attack(t, cardDmg(g, c), c);
      g.heal(g.player, c.up ? 3 : 2);
    },
  },
]);
