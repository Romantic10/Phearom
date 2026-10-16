import { Activity, Gauge, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { JobState } from '../types.ts';

interface ProgressCardProps {
  job: JobState;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({ job }) => {
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-blue-400 animate-pulse" />
          <h3 className="text-base font-semibold text-white">
            {isCompleted
              ? 'Lossless Remux Completed'
              : isFailed
              ? 'Remux Failed'
              : 'Remuxing Streams in Real-Time'}
          </h3>
        </div>

        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            isCompleted
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              : isFailed
              ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
              : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
          }`}
        >
          {isCompleted ? 'Finished (100%)' : isFailed ? 'Error' : `${job.progressPercent}%`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : isFailed
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400'
            }`}
            style={{ width: `${Math.max(5, job.progressPercent)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Direct packet transfer & FastStart relocation</span>
          <span>{job.progressPercent}% Complete</span>
        </div>
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Gauge className="h-3.5 w-3.5 text-blue-400" />
            <span>Process Speed</span>
          </div>
          <div className="text-sm font-bold text-white tracking-tight">
            {job.speed || 'Direct IO'}
          </div>
          <div className="text-[10px] text-emerald-400">
            {isCompleted ? 'Zero frame render wait' : 'Stream copy throughput'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            <span>Packets / Frames</span>
          </div>
          <div className="text-sm font-bold text-white tracking-tight">
            {job.frame ? `${job.frame} frames` : 'Transferring'}
          </div>
          <div className="text-[10px] text-slate-500">
            Bit-for-bit preserved
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>Throughput Rate</span>
          </div>
          <div className="text-sm font-bold text-white tracking-tight">
            {job.fps ? `${job.fps.toFixed(0)} fps` : 'Native IO'}
          </div>
          <div className="text-[10px] text-slate-500">
            No CPU transcoding load
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Generation Loss</span>
          </div>
          <div className="text-sm font-bold text-emerald-400 tracking-tight">
            0.00% (Lossless)
          </div>
          <div className="text-[10px] text-emerald-500">
            Pristine stream copy
          </div>
        </div>
      </div>

      {/* Error Details */}
      {isFailed && job.error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs space-y-1">
          <div className="flex items-center gap-2 font-semibold text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            <span>FFmpeg Processing Error</span>
          </div>
          <p className="font-mono text-[11px] text-rose-300/90 whitespace-pre-wrap break-all pt-1">
            {job.error}
          </p>
        </div>
      )}
    </div>
  );
};
