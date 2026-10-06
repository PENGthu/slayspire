import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { ENEMIES } from '../src/game/registry';
import { enemyArtSvg, hasEnemyArt } from '../src/ui/art/enemyArt';

describe('敌人立绘', () => {
  it('每个敌人都有立绘，且能生成 SVG', () => {
    const missing = Object.keys(ENEMIES).filter((id) => !hasEnemyArt(id));
    expect(missing).toEqual([]);
    for (const id of Object.keys(ENEMIES)) {
      const svg = enemyArtSvg(id);
      expect(svg.startsWith('<svg'), id).toBe(true);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('undefined');
    }
  });
});
