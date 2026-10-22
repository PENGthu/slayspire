// 范围的文字导入 / 导出：每个非弃牌行动一行，"行动名: 范围记法"。
import { HAND_COUNT, HAND_LABELS } from '../poker/cards';
import { formatRange, parseRange, RangeParseError } from '../poker/range';
import { freqAt, type SpotNode } from './types';

/** 导出：每个非弃牌行动一行，只包含到达此处的手牌 */
export function exportNode(node: SpotNode): string {
  const k = node.actions.length;
  const lines: string[] = [];
  for (let a = k - 1; a >= 1; a--) {
    const r = new Float32Array(HAND_COUNT);
    for (let h = 0; h < HAND_COUNT; h++) r[h] = node.heroReach[h] > 0 ? freqAt(node, h, a) : 0;
    lines.push(`${node.actions[a].short}: ${formatRange(r)}`);
  }
  return lines.join('\n');
}

/** 导入：解析"行动名: 范围"的多行文本，返回新的策略矩阵 */
export function importNode(node: SpotNode, text: string): Float32Array {
  const k = node.actions.length;
  const parts: (Float32Array | null)[] = new Array(k).fill(null);
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^:：]+)[:：](.*)$/);
    if (!m) throw new RangeParseError(`这一行缺少"行动名:"：${line}`);
    const name = m[1].trim().toLowerCase();
    const a = node.actions.findIndex(
      (x, i) => i > 0 && [x.short, x.label, x.id].some((y) => y.toLowerCase() === name || y.toLowerCase().replace(/[\s-]/g, '') === name.replace(/[\s-]/g, '')),
    );
    if (a < 0) throw new RangeParseError(`没有名为"${m[1].trim()}"的行动，可用：${node.actions.slice(1).map((x) => x.short).join('、')}`);
    parts[a] = parseRange(m[2]);
  }
  const s = new Float32Array(HAND_COUNT * k);
  for (let h = 0; h < HAND_COUNT; h++) {
    let sum = 0;
    for (let a = 1; a < k; a++) sum += parts[a]?.[h] ?? 0;
    if (sum > 1 + 1e-6) throw new RangeParseError(`${HAND_LABELS[h]} 的频率之和超过 100%`);
    for (let a = 1; a < k; a++) s[h * k + a] = parts[a]?.[h] ?? 0;
    s[h * k] = Math.max(0, 1 - sum);
  }
  return s;
}
