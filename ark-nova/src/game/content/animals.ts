// 动物卡。数值为原创设计，沿用原作的结构：体型（所需围栏大小）、费用、大洲与种类图标、
// 水域 / 岩石相邻要求、声望 / 图标 / 升级要求，以及打出时获得的吸引力、保护点数、声望和能力。
import type { Ability, AnimalCard, Category, Continent, Requirement, SpecialKind } from '../types';

const CONT: Record<string, Continent> = { af: 'africa', eu: 'europe', as: 'asia', am: 'americas', au: 'australia' };
const CAT: Record<string, Category> = {
  pred: 'predator',
  herb: 'herbivore',
  bird: 'bird',
  rept: 'reptile',
  prim: 'primate',
  bear: 'bear',
  pet: 'petting',
};

interface Opts {
  /** 特殊场馆：r=爬行馆 a=鸟舍 p=儿童动物园，后接占用容量 */
  sp?: string;
  w?: number;
  k?: number;
  req?: Requirement[];
  cp?: number;
  rep?: number;
  ab?: Ability;
}

export const ANIMALS: AnimalCard[] = [];

/** 费用整体缩放（用于平衡：让一局的节奏接近原作的 30 多个回合） */
const COST_SCALE = 0.85;

function A(
  id: string,
  name: string,
  en: string,
  emoji: string,
  size: number,
  cost: number,
  conts: string,
  cats: string,
  appeal: number,
  o: Opts = {},
) {
  let special: { kind: SpecialKind; units: number } | undefined;
  if (o.sp) {
    const kind: SpecialKind = o.sp[0] === 'r' ? 'reptile' : o.sp[0] === 'a' ? 'aviary' : 'petting';
    special = { kind, units: Number(o.sp.slice(1)) || 1 };
  }
  ANIMALS.push({
    kind: 'animal',
    id,
    num: 0,
    name,
    en,
    emoji,
    size,
    special,
    cost: Math.max(2, Math.round(cost * COST_SCALE)),
    continents: conts ? conts.split(' ').map((c) => CONT[c]) : [],
    categories: cats.split(' ').map((c) => CAT[c]),
    water: o.w,
    rock: o.k,
    req: o.req,
    appeal,
    cp: o.cp,
    rep: o.rep,
    ability: o.ab,
  });
}

const II = (action: 'animals' | 'build' | 'association'): Requirement => ({ k: 'upgrade', action });
const REP = (n: number): Requirement => ({ k: 'rep', n });
const SCI = (n: number): Requirement => ({ k: 'icon', icon: 'science', n });

// ———————————————————————————————————————————— 非洲
A('lion', '狮子', 'Lion', '🦁', 4, 18, 'af', 'pred', 6, { ab: { k: 'pack', cat: 'predator' } });
A('african_elephant', '非洲草原象', 'African Bush Elephant', '🐘', 5, 25, 'af', 'herb', 9, { cp: 1, req: [II('animals')] });
A('giraffe', '网纹长颈鹿', 'Reticulated Giraffe', '🦒', 4, 17, 'af', 'herb', 6, { ab: { k: 'sprint', n: 1 } });
A('zebra', '平原斑马', 'Plains Zebra', '🦓', 3, 12, 'af', 'herb', 4, { ab: { k: 'pack', cat: 'herbivore' } });
A('hippo', '河马', 'Hippopotamus', '🦛', 4, 15, 'af', 'herb', 6, { w: 2 });
A('white_rhino', '白犀', 'White Rhinoceros', '🦏', 5, 22, 'af', 'herb', 7, { cp: 2, req: [REP(3)] });
A('cheetah', '猎豹', 'Cheetah', '🐆', 3, 15, 'af', 'pred', 5, { ab: { k: 'sprint', n: 2 } });
A('leopard', '非洲豹', 'African Leopard', '🐆', 3, 14, 'af', 'pred', 5, { k: 1, ab: { k: 'hunter', n: 3 } });
A('wild_dog', '非洲野犬', 'African Wild Dog', '🐕', 3, 12, 'af', 'pred', 4, { cp: 1, ab: { k: 'pack', cat: 'predator' } });
A('hyena', '斑鬣狗', 'Spotted Hyena', '🐺', 3, 11, 'af', 'pred', 3, { ab: { k: 'scavenge', n: 4 } });
A('meerkat', '狐獴', 'Meerkat', '🐿️', 1, 6, 'af', 'pred', 2, { ab: { k: 'sunbathe', n: 1 } });
A('gorilla', '西部大猩猩', 'Western Gorilla', '🦍', 4, 20, 'af', 'prim', 7, { cp: 1, req: [REP(4)] });
A('chimpanzee', '黑猩猩', 'Chimpanzee', '🐒', 3, 14, 'af', 'prim', 4, { ab: { k: 'clever' } });
A('baboon', '阿拉伯狒狒', 'Hamadryas Baboon', '🐒', 3, 11, 'af', 'prim', 4, { k: 1, ab: { k: 'pack', cat: 'primate' } });
A('ring_tailed_lemur', '环尾狐猴', 'Ring-tailed Lemur', '🐒', 2, 9, 'af', 'prim', 3, { ab: { k: 'sunbathe', n: 2 } });
A('aye_aye', '指猴', 'Aye-aye', '🐒', 1, 8, 'af', 'prim', 2, { rep: 1, ab: { k: 'dig', n: 2 } });
A('nile_crocodile', '尼罗鳄', 'Nile Crocodile', '🐊', 4, 15, 'af', 'rept', 5, { w: 1, ab: { k: 'hunter', n: 3 } });
A('leopard_tortoise', '豹纹陆龟', 'Leopard Tortoise', '🐢', 2, 7, 'af', 'rept', 2, { sp: 'r1', ab: { k: 'xtoken', n: 1 } });
A('rock_python', '非洲岩蟒', 'African Rock Python', '🐍', 3, 10, 'af', 'rept', 3, { sp: 'r2', ab: { k: 'constrict' } });
A('black_mamba', '黑曼巴蛇', 'Black Mamba', '🐍', 1, 7, 'af', 'rept', 2, { sp: 'r1', ab: { k: 'venom', n: 3 } });
A('ostrich', '鸵鸟', 'Common Ostrich', '🦤', 3, 11, 'af', 'bird', 4, { ab: { k: 'jump', n: 2 } });
A('flamingo', '小红鹳', 'Lesser Flamingo', '🦩', 2, 9, 'af', 'bird', 3, { w: 1, ab: { k: 'pack', cat: 'bird' } });
A('crowned_crane', '灰冠鹤', 'Grey Crowned Crane', '🐦', 2, 8, 'af', 'bird', 3, { sp: 'a1', w: 1 });
A('african_penguin', '非洲企鹅', 'African Penguin', '🐧', 2, 9, 'af', 'bird', 3, { w: 1, cp: 1 });
A('secretary_bird', '蛇鹫', 'Secretarybird', '🦅', 2, 10, 'af', 'bird', 3, { ab: { k: 'hunter', n: 2 } });
A('okapi', '獾狮狓', 'Okapi', '🦓', 3, 14, 'af', 'herb', 4, { cp: 1, rep: 1 });
A('serval', '薮猫', 'Serval', '🐈', 2, 9, 'af', 'pred', 3, { ab: { k: 'snap', n: 1 } });
A('warthog', '疣猪', 'Common Warthog', '🐗', 2, 8, 'af', 'herb', 3, { ab: { k: 'dig', n: 1 } });
A('wildebeest', '角马', 'Blue Wildebeest', '🐃', 3, 11, 'af', 'herb', 4, { ab: { k: 'jump', n: 2 } });
A('fennec', '耳廓狐', 'Fennec Fox', '🦊', 1, 6, 'af', 'pred', 2, { ab: { k: 'sprint', n: 1 } });
A('bonobo', '倭黑猩猩', 'Bonobo', '🐒', 3, 15, 'af', 'prim', 5, { cp: 1, req: [II('animals')], ab: { k: 'perception', n: 3 } });
A('shoebill', '鲸头鹳', 'Shoebill', '🐦', 3, 13, 'af', 'bird', 4, { w: 1, rep: 1, ab: { k: 'boost', action: 'animals' } });

// ———————————————————————————————————————————— 欧洲
A('brown_bear', '棕熊', 'Brown Bear', '🐻', 4, 16, 'eu', 'bear', 6, { ab: { k: 'hunter', n: 2 } });
A('grey_wolf', '灰狼', 'Grey Wolf', '🐺', 3, 13, 'eu', 'pred', 4, { ab: { k: 'pack', cat: 'predator' } });
A('lynx', '欧亚猞猁', 'Eurasian Lynx', '🐈', 2, 11, 'eu', 'pred', 3, { k: 1, ab: { k: 'hunter', n: 3 } });
A('wisent', '欧洲野牛', 'European Bison', '🦬', 4, 16, 'eu', 'herb', 5, { cp: 1 });
A('red_deer', '马鹿', 'Red Deer', '🦌', 3, 11, 'eu', 'herb', 4, { ab: { k: 'jump', n: 1 } });
A('red_fox', '赤狐', 'Red Fox', '🦊', 1, 7, 'eu', 'pred', 2, { ab: { k: 'clever' } });
A('otter', '欧亚水獭', 'Eurasian Otter', '🦦', 2, 9, 'eu', 'pred', 3, { w: 1, ab: { k: 'sprint', n: 1 } });
A('white_stork', '白鹳', 'White Stork', '🐦', 2, 8, 'eu', 'bird', 3, { sp: 'a1', ab: { k: 'jump', n: 1 } });
A('eagle_owl', '雕鸮', 'Eurasian Eagle-Owl', '🦉', 2, 9, 'eu', 'bird', 3, { sp: 'a1', k: 1, ab: { k: 'perception', n: 3 } });
A('golden_eagle', '金雕', 'Golden Eagle', '🦅', 3, 12, 'eu', 'bird', 4, { sp: 'a2', k: 1, ab: { k: 'snap', n: 1 } });
A('ibex', '阿尔卑斯羱羊', 'Alpine Ibex', '🐐', 2, 8, 'eu', 'herb', 3, { k: 2, ab: { k: 'jump', n: 1 } });
A('adder', '极北蝰', 'Common European Adder', '🐍', 1, 6, 'eu', 'rept', 2, { sp: 'r1', ab: { k: 'venom', n: 2 } });
A('pond_turtle', '欧洲泽龟', 'European Pond Turtle', '🐢', 1, 6, 'eu', 'rept', 1, { sp: 'r1', w: 1, cp: 1 });
A('griffon_vulture', '兀鹫', 'Griffon Vulture', '🦅', 3, 11, 'eu', 'bird', 4, { sp: 'a2', k: 1, ab: { k: 'scavenge', n: 3 } });
A('red_squirrel', '欧亚红松鼠', 'Red Squirrel', '🐿️', 1, 5, 'eu', 'herb', 2, { ab: { k: 'dig', n: 1 } });
A('wild_cat', '欧洲野猫', 'European Wildcat', '🐈', 1, 7, 'eu', 'pred', 2, { rep: 1 });
A('european_hamster', '欧洲仓鼠', 'European Hamster', '🐹', 1, 5, 'eu', 'herb', 1, { cp: 1 });
A('eurasian_crane', '灰鹤', 'Common Crane', '🐦', 3, 12, 'eu', 'bird', 4, { w: 1, ab: { k: 'boost', action: 'cards' } });
A('moose', '驼鹿', 'Moose', '🫎', 4, 15, 'eu', 'herb', 5, { w: 1, ab: { k: 'boost', action: 'build' } });

// ———————————————————————————————————————————— 亚洲
A('bengal_tiger', '孟加拉虎', 'Bengal Tiger', '🐅', 4, 19, 'as', 'pred', 7, { cp: 1 });
A('giant_panda', '大熊猫', 'Giant Panda', '🐼', 4, 21, 'as', 'bear', 8, { cp: 2, req: [REP(5)] });
A('asian_elephant', '亚洲象', 'Asian Elephant', '🐘', 5, 24, 'as', 'herb', 8, { cp: 1, req: [II('animals')], ab: { k: 'boost', action: 'association' } });
A('snow_leopard', '雪豹', 'Snow Leopard', '🐆', 3, 16, 'as', 'pred', 5, { k: 2, cp: 1 });
A('red_panda', '小熊猫', 'Red Panda', '🦝', 2, 11, 'as', 'herb', 3, { cp: 1, ab: { k: 'iconic', cont: 'asia' } });
A('sun_bear', '马来熊', 'Sun Bear', '🐻', 3, 13, 'as', 'bear', 4, { ab: { k: 'sunbathe', n: 2 } });
A('sloth_bear', '懒熊', 'Sloth Bear', '🐻', 3, 12, 'as', 'bear', 4, { ab: { k: 'dig', n: 2 } });
A('orangutan', '婆罗洲猩猩', 'Bornean Orangutan', '🦧', 4, 19, 'as', 'prim', 6, { cp: 1, ab: { k: 'clever' } });
A('gibbon', '白掌长臂猿', 'Lar Gibbon', '🐒', 3, 13, 'as', 'prim', 4, { ab: { k: 'sprint', n: 2 } });
A('macaque', '日本猕猴', 'Japanese Macaque', '🐵', 3, 11, 'as', 'prim', 4, { w: 1, ab: { k: 'pack', cat: 'primate' } });
A('indian_rhino', '印度犀', 'Indian Rhinoceros', '🦏', 5, 22, 'as', 'herb', 7, { w: 1, cp: 2 });
A('bactrian_camel', '双峰驼', 'Bactrian Camel', '🐫', 4, 14, 'as', 'herb', 5, { ab: { k: 'jump', n: 2 } });
A('komodo', '科莫多巨蜥', 'Komodo Dragon', '🦎', 3, 14, 'as', 'rept', 4, { cp: 1, ab: { k: 'venom', n: 3 } });
A('cobra', '印度眼镜蛇', 'Indian Cobra', '🐍', 1, 7, 'as', 'rept', 2, { sp: 'r1', ab: { k: 'hypnosis', n: 3 } });
A('reticulated_python', '网纹蟒', 'Reticulated Python', '🐍', 3, 11, 'as', 'rept', 4, { sp: 'r2', ab: { k: 'constrict' } });
A('peafowl', '蓝孔雀', 'Indian Peafowl', '🦚', 2, 8, 'as', 'bird', 3, { ab: { k: 'posture', n: 1 } });
A('red_crowned_crane', '丹顶鹤', 'Red-crowned Crane', '🐦', 3, 12, 'as', 'bird', 4, { w: 1, cp: 1 });
A('mandarin_duck', '鸳鸯', 'Mandarin Duck', '🦆', 1, 5, 'as', 'bird', 2, { sp: 'a1', w: 1 });
A('pere_david_deer', '麋鹿', "Père David's Deer", '🦌', 3, 12, 'as', 'herb', 4, { w: 1, cp: 1 });
A('yak', '牦牛', 'Wild Yak', '🐂', 3, 10, 'as', 'herb', 3, { k: 1, ab: { k: 'money', n: 3 } });
A('black_bear_asia', '亚洲黑熊', 'Asian Black Bear', '🐻', 3, 13, 'as', 'bear', 4, { k: 1, ab: { k: 'hunter', n: 2 } });
A('clouded_leopard', '云豹', 'Clouded Leopard', '🐆', 2, 11, 'as', 'pred', 3, { cp: 1, ab: { k: 'snap', n: 1 } });
A('proboscis_monkey', '长鼻猴', 'Proboscis Monkey', '🐒', 3, 12, 'as', 'prim', 4, { w: 1, rep: 1 });
A('star_tortoise', '印度星龟', 'Indian Star Tortoise', '🐢', 1, 6, 'as', 'rept', 2, { sp: 'r1', ab: { k: 'dig', n: 1 } });
A('slow_loris', '懒猴', 'Slow Loris', '🐒', 1, 7, 'as', 'prim', 2, { ab: { k: 'venom', n: 1 } });
A('malayan_tapir', '马来貘', 'Malayan Tapir', '🐗', 3, 12, 'as', 'herb', 4, { w: 1, cp: 1 });
A('hornbill', '双角犀鸟', 'Great Hornbill', '🐦', 2, 9, 'as', 'bird', 3, { sp: 'a1', ab: { k: 'sprint', n: 1 } });
A('golden_monkey', '川金丝猴', 'Golden Snub-nosed Monkey', '🐒', 3, 14, 'as', 'prim', 4, { k: 1, cp: 1, req: [SCI(1)], ab: { k: 'iconic', cont: 'asia' } });
A('gharial', '恒河鳄', 'Gharial', '🐊', 4, 14, 'as', 'rept', 5, { w: 2, cp: 1, req: [SCI(1)] });
A('pallas_cat', '兔狲', "Pallas's Cat", '🐈', 1, 7, 'as', 'pred', 2, { k: 1, ab: { k: 'trade' } });

// ———————————————————————————————————————————— 美洲
A('jaguar', '美洲豹', 'Jaguar', '🐆', 4, 18, 'am', 'pred', 6, { w: 1, ab: { k: 'hunter', n: 3 } });
A('cougar', '美洲狮', 'Cougar', '🐆', 3, 14, 'am', 'pred', 5, { k: 1, ab: { k: 'sprint', n: 2 } });
A('polar_bear', '北极熊', 'Polar Bear', '🐻‍❄️', 5, 23, 'am', 'bear', 8, { w: 2, cp: 1, req: [II('animals')] });
A('black_bear', '美洲黑熊', 'American Black Bear', '🐻', 4, 15, 'am', 'bear', 5, { ab: { k: 'scavenge', n: 3 } });
A('bison', '美洲野牛', 'American Bison', '🦬', 4, 16, 'am', 'herb', 5, { ab: { k: 'jump', n: 2 } });
A('llama', '羊驼', 'Llama', '🦙', 2, 8, 'am', 'herb', 3, { k: 1, ab: { k: 'venom', n: 1 } });
A('sloth', '二趾树懒', "Linnaeus's Two-toed Sloth", '🦥', 2, 9, 'am', 'herb', 3, { ab: { k: 'xtoken', n: 2 } });
A('anteater', '大食蚁兽', 'Giant Anteater', '🐜', 3, 12, 'am', 'herb', 4, { ab: { k: 'dig', n: 2 } });
A('capybara', '水豚', 'Capybara', '🦫', 2, 8, 'am', 'herb', 3, { w: 1, ab: { k: 'pack', cat: 'herbivore' } });
A('capuchin', '白面卷尾猴', 'White-faced Capuchin', '🐒', 2, 9, 'am', 'prim', 3, { ab: { k: 'clever' } });
A('lion_tamarin', '金狮狨', 'Golden Lion Tamarin', '🐒', 1, 8, 'am', 'prim', 2, { cp: 1 });
A('howler', '黑吼猴', 'Black Howler', '🐒', 3, 12, 'am', 'prim', 4, { ab: { k: 'posture', n: 1 } });
A('alligator', '美国短吻鳄', 'American Alligator', '🐊', 4, 15, 'am', 'rept', 5, { w: 2, ab: { k: 'hunter', n: 2 } });
A('iguana', '绿鬣蜥', 'Green Iguana', '🦎', 1, 6, 'am', 'rept', 2, { sp: 'r1', ab: { k: 'sunbathe', n: 1 } });
A('galapagos_tortoise', '加拉帕戈斯象龟', 'Galápagos Giant Tortoise', '🐢', 3, 13, 'am', 'rept', 4, { sp: 'r2', cp: 2 });
A('anaconda', '绿森蚺', 'Green Anaconda', '🐍', 3, 12, 'am', 'rept', 4, { sp: 'r2', w: 1, ab: { k: 'constrict' } });
A('dart_frog', '箭毒蛙', 'Poison Dart Frog', '🐸', 1, 6, 'am', 'rept', 2, { sp: 'r1', ab: { k: 'venom', n: 2 } });
A('macaw', '绯红金刚鹦鹉', 'Scarlet Macaw', '🦜', 2, 9, 'am', 'bird', 3, { sp: 'a1', ab: { k: 'snap', n: 1 } });
A('scarlet_ibis', '美洲红鹮', 'Scarlet Ibis', '🐦', 2, 8, 'am', 'bird', 3, { sp: 'a1', w: 1 });
A('bald_eagle', '白头海雕', 'Bald Eagle', '🦅', 3, 12, 'am', 'bird', 4, { sp: 'a2', k: 1, rep: 1 });
A('condor', '安第斯神鹫', 'Andean Condor', '🦅', 4, 15, 'am', 'bird', 5, { sp: 'a2', k: 1, cp: 1 });
A('humboldt_penguin', '洪堡企鹅', 'Humboldt Penguin', '🐧', 2, 9, 'am', 'bird', 3, { w: 1, ab: { k: 'pack', cat: 'bird' } });
A('raccoon', '浣熊', 'Raccoon', '🦝', 1, 6, 'am', 'pred', 2, { ab: { k: 'scavenge', n: 2 } });
A('giant_otter', '大水獭', 'Giant Otter', '🦦', 3, 13, 'am', 'pred', 4, { w: 2, cp: 1 });
A('armadillo', '九带犰狳', 'Nine-banded Armadillo', '🦔', 1, 6, 'am', 'herb', 2, { ab: { k: 'dig', n: 1 } });
A('flamingo_am', '美洲红鹳', 'American Flamingo', '🦩', 2, 9, 'am', 'bird', 3, { w: 1, ab: { k: 'pack', cat: 'bird' } });
A('sea_lion', '加州海狮', 'California Sea Lion', '🦭', 4, 16, 'am', 'pred', 6, { w: 2, ab: { k: 'posture', n: 1 } });

// ———————————————————————————————————————————— 大洋洲
A('red_kangaroo', '红袋鼠', 'Red Kangaroo', '🦘', 3, 12, 'au', 'herb', 4, { ab: { k: 'pouch' } });
A('koala', '考拉', 'Koala', '🐨', 2, 11, 'au', 'herb', 4, { cp: 1, req: [REP(2)] });
A('wombat', '袋熊', 'Common Wombat', '🐻', 2, 9, 'au', 'herb', 3, { ab: { k: 'dig', n: 2 } });
A('platypus', '鸭嘴兽', 'Platypus', '🦫', 2, 10, 'au', 'pred', 3, { w: 2, cp: 1, ab: { k: 'venom', n: 1 } });
A('tasmanian_devil', '袋獾', 'Tasmanian Devil', '😈', 2, 10, 'au', 'pred', 3, { cp: 1, ab: { k: 'scavenge', n: 2 } });
A('dingo', '澳洲野犬', 'Dingo', '🐕', 3, 11, 'au', 'pred', 4, { ab: { k: 'pack', cat: 'predator' } });
A('emu', '鸸鹋', 'Emu', '🐦', 3, 11, 'au', 'bird', 4, { ab: { k: 'sprint', n: 1 } });
A('cassowary', '双垂鹤鸵', 'Southern Cassowary', '🐦', 3, 13, 'au', 'bird', 4, { ab: { k: 'assert' } });
A('kookaburra', '笑翠鸟', 'Laughing Kookaburra', '🐦', 1, 6, 'au', 'bird', 2, { sp: 'a1', ab: { k: 'snap', n: 1 } });
A('cockatoo', '葵花凤头鹦鹉', 'Sulphur-crested Cockatoo', '🦜', 2, 8, 'au', 'bird', 3, { sp: 'a1', ab: { k: 'clever' } });
A('saltwater_croc', '湾鳄', 'Saltwater Crocodile', '🐊', 5, 20, 'au', 'rept', 7, { w: 2, req: [II('animals')], ab: { k: 'hunter', n: 3 } });
A('frilled_lizard', '伞蜥', 'Frilled Lizard', '🦎', 1, 6, 'au', 'rept', 2, { sp: 'r1', ab: { k: 'posture', n: 1 } });
A('echidna', '短吻针鼹', 'Short-beaked Echidna', '🦔', 1, 6, 'au', 'herb', 2, { ab: { k: 'dig', n: 1 } });
A('tree_kangaroo', '树袋鼠', "Goodfellow's Tree-kangaroo", '🦘', 2, 10, 'au', 'herb', 3, { cp: 1, ab: { k: 'pouch' } });
A('wallaby', '沙袋鼠', 'Red-necked Wallaby', '🦘', 2, 8, 'au', 'herb', 3, { ab: { k: 'pouch' } });
A('little_penguin', '小蓝企鹅', 'Little Penguin', '🐧', 1, 6, 'au', 'bird', 2, { w: 1 });
A('quokka', '短尾矮袋鼠', 'Quokka', '🦘', 1, 7, 'au', 'herb', 2, { rep: 1 });
A('lace_monitor', '花斑巨蜥', 'Lace Monitor', '🦎', 3, 11, 'au', 'rept', 4, { sp: 'r2', ab: { k: 'hunter', n: 2 } });

// ———————————————————————————————————————————— 宠物（只能放进儿童动物园）
A('goat', '山羊', 'Domestic Goat', '🐐', 0, 4, '', 'pet', 1, { sp: 'p1', ab: { k: 'money', n: 2 } });
A('sheep', '绵羊', 'Domestic Sheep', '🐑', 0, 4, '', 'pet', 1, { sp: 'p1', ab: { k: 'sprint', n: 1 } });
A('rabbit', '家兔', 'Domestic Rabbit', '🐇', 0, 3, '', 'pet', 1, { sp: 'p1' });
A('donkey', '驴', 'Donkey', '🫏', 0, 5, '', 'pet', 2, { sp: 'p1' });
A('pig', '小香猪', 'Mini Pig', '🐖', 0, 4, '', 'pet', 1, { sp: 'p1', ab: { k: 'dig', n: 1 } });
A('guinea_pig', '豚鼠', 'Guinea Pig', '🐹', 0, 3, '', 'pet', 1, { sp: 'p1', ab: { k: 'xtoken', n: 1 } });
A('pony', '设得兰矮马', 'Shetland Pony', '🐴', 0, 5, '', 'pet', 2, { sp: 'p1', rep: 1 });
A('chicken', '丝羽乌骨鸡', 'Silkie Chicken', '🐔', 0, 3, '', 'pet', 1, { sp: 'p1', ab: { k: 'jump', n: 1 } });
