// 启动求解：优先用后台线程（Web Worker），不可用时退回主线程分段计算。
import { PreflopSolver, type SolverConfig, type SolverResult } from './solver';
import type { WorkerOut } from './solver.worker';
import SolverWorker from './solver.worker?worker&inline';

export interface SolveProgress {
  iteration: number;
  total: number;
  exploitability: number;
}

export interface SolveJob {
  promise: Promise<SolverResult>;
  cancel: () => void;
}

export function startSolve(config: SolverConfig, onProgress: (p: SolveProgress) => void): SolveJob {
  let worker: Worker | null = null;
  try {
    worker = new SolverWorker();
  } catch {
    worker = null;
  }
  if (worker) {
    const w = worker;
    let reject: (e: Error) => void = () => {};
    let started = false;
    let fallback: SolveJob | null = null;
    const promise = new Promise<SolverResult>((res, rej) => {
      reject = rej;
      w.onmessage = (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        started = true;
        if (m.type === 'progress') onProgress(m);
        else if (m.type === 'done') {
          res(m.result);
          w.terminate();
        } else {
          rej(new Error(m.message));
          w.terminate();
        }
      };
      w.onerror = (e) => {
        w.terminate();
        // 有些环境（如直接双击打开的本地文件）不允许启动后台线程：改在主线程计算
        if (!started) {
          fallback = solveOnMainThread(config, onProgress);
          fallback.promise.then(res, rej);
        } else rej(new Error(e.message || '后台计算出错'));
      };
      w.postMessage({ type: 'solve', config });
    });
    return {
      promise,
      cancel: () => {
        w.terminate();
        fallback?.cancel();
        reject(new Error('cancelled'));
      },
    };
  }
  return solveOnMainThread(config, onProgress);
}

function solveOnMainThread(config: SolverConfig, onProgress: (p: SolveProgress) => void): SolveJob {
  let cancelled = false;
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<SolverResult>((res, rej) => {
    reject = rej;
    const s = new PreflopSolver(config);
    const tick = () => {
      if (cancelled) return;
      s.run(Math.min(10, config.iterations - s.iteration));
      onProgress({ iteration: s.iteration, total: config.iterations, exploitability: s.exploitability() });
      if (s.iteration >= config.iterations) res(s.result());
      else setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
      reject(new Error('cancelled'));
    },
  };
}
