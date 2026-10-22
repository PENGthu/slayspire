// 在后台线程里运行求解器，避免界面卡顿。
import { PreflopSolver, type SolverConfig } from './solver';

export type WorkerIn = { type: 'solve'; config: SolverConfig };
export type WorkerOut =
  | { type: 'progress'; iteration: number; total: number; exploitability: number }
  | { type: 'done'; result: ReturnType<PreflopSolver['result']> }
  | { type: 'error'; message: string };

const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  if (e.data.type !== 'solve') return;
  try {
    const cfg = e.data.config;
    const s = new PreflopSolver(cfg);
    const step = 25;
    while (s.iteration < cfg.iterations) {
      s.run(Math.min(step, cfg.iterations - s.iteration));
      post({ type: 'progress', iteration: s.iteration, total: cfg.iterations, exploitability: s.exploitability() });
    }
    post({ type: 'done', result: s.result() });
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
};
