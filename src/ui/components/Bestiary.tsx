import { useState } from 'preact/hooks';
import { bestiary, hpRange, INTENT_NAMES, RANK_NAMES, REGIONS, type BestiaryEntry, type RegionId } from '../../game/bestiary';
import { enemyArtUrl } from '../art/enemyArt';
import { useBitmap } from '../art/raster';
import { IntentIcon } from './Art';

/** 图鉴：怪物分页 */
export function Bestiary() {
  const all = bestiary();
  const [region, setRegion] = useState<RegionId>('overgrowth');
  const list = all.filter((e) => e.regions.includes(region));
  const [picked, setPicked] = useState<string>(list[0]?.def.id ?? '');
  const sel = list.find((e) => e.def.id === picked) ?? list[0];
  return (
    <div class="bestiary">
      <div class="bestiary-left">
        <div class="bestiary-regions">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              class={`btn small ${region === r.id ? 'primary' : 'ghost'}`}
              onClick={() => {
                setRegion(r.id);
                setPicked(all.find((e) => e.regions.includes(r.id))?.def.id ?? '');
              }}
            >
              {r.name}
              <span class="bestiary-sub">{r.sub}</span>
            </button>
          ))}
        </div>
        <div class="bestiary-grid">
          {list.map((e) => (
            <button key={e.def.id} class={`bestiary-tile rank-${e.rank} ${sel?.def.id === e.def.id ? 'on' : ''}`} onClick={() => setPicked(e.def.id)}>
              <MonsterImg id={e.def.id} size={92} />
              <span class="bestiary-name">{e.def.name}</span>
              <span class="bestiary-rank">{RANK_NAMES[e.rank]}</span>
            </button>
          ))}
        </div>
      </div>
      {sel && <MonsterDetail entry={sel} />}
    </div>
  );
}

function MonsterImg({ id, size }: { id: string; size: number }) {
  const url = useBitmap(enemyArtUrl(id), 200, 200);
  return url ? <img src={url} width={size} height={size} alt="" draggable={false} /> : <span style={{ width: `${size}px`, height: `${size}px` }} />;
}

function MonsterDetail({ entry: e }: { entry: BestiaryEntry }) {
  const regions = e.regions.map((r) => REGIONS.find((x) => x.id === r)!.name).join('、');
  return (
    <div class="bestiary-detail">
      <div class="bestiary-hero">
        <MonsterImg id={e.def.id} size={168} />
        <div class="bestiary-head">
          <h3>{e.def.name}</h3>
          <div class={`bestiary-badge rank-${e.rank}`}>{RANK_NAMES[e.rank]}</div>
          <dl>
            <dt>生命</dt>
            <dd class="num">{hpRange(e.def)}</dd>
            <dt>出没</dt>
            <dd>{regions}</dd>
            {e.summoner && (
              <>
                <dt>召唤者</dt>
                <dd>{e.summoner}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
      {e.def.desc && <p class="bestiary-desc">{e.def.desc}</p>}
      {e.powers.length > 0 && (
        <section>
          <h4>能力</h4>
          {e.powers.map((p) => (
            <div key={p.id} class="bestiary-power">
              <span class="bestiary-power-art">{p.art}</span>
              <div>
                <b>
                  {p.name}
                  {p.amount > 1 ? ` ${p.amount}` : ''}
                </b>
                <span>{p.desc}</span>
              </div>
            </div>
          ))}
        </section>
      )}
      <section>
        <h4>招式</h4>
        {e.moves.map((m) => (
          <div key={m.id} class="bestiary-move">
            <span class="bestiary-intent">
              <IntentIcon kind={m.intent} />
            </span>
            <b>{m.name}</b>
            <span class="bestiary-kind">{INTENT_NAMES[m.intent]}</span>
            <span class="bestiary-dmg num">{m.dmg}</span>
          </div>
        ))}
      </section>
      {e.encounters.length > 0 && (
        <section>
          <h4>遭遇</h4>
          <p class="bestiary-encs">{e.encounters.join(' · ')}</p>
        </section>
      )}
    </div>
  );
}
