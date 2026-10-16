import { Layers, ShieldCheck, AlertCircle, BookOpen, Terminal, Trash2 } from 'lucide-react';
import type { HealthStatus } from '../types.ts';

interface HeaderProps {
  health: HealthStatus | null;
  onOpenGuide: () => void;
  onOpenSetup: () => void;
  hasActiveJob: boolean;
  onClearSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  onOpenGuide,
  onOpenSetup,
  hasActiveJob,
  onClearSession
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="h-5 w-5 text-blue-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-white flex items-center">
                Clear<span className="text-blue-400">Frame</span>
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60">
                Lossless Remux
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Zero-generation-loss video stream copy & FFprobe inspector
            </p>
          </div>
        </div>

        {/* Status badges & actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {health ? (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                health.status === 'healthy'
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}
              title={`FFmpeg: ${health.ffmpegVersion} | FFprobe: ${health.ffprobeVersion}`}
            >
              {health.status === 'healthy' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              )}
              <span>{health.status === 'healthy' ? 'FFmpeg Engine Active' : 'FFmpeg Degraded / Missing'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-600 animate-ping"></span>
              Checking FFmpeg...
            </div>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-400" />
            <span>Social Guide</span>
          </button>

          <button
            type="button"
            onClick={onOpenSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors cursor-pointer"
          >
            <Terminal className="h-3.5 w-3.5 text-indigo-400" />
            <span>Setup & Deploy</span>
          </button>

          {hasActiveJob && (
            <button
              type="button"
              onClick={onClearSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 text-rose-300 transition-colors cursor-pointer"
              title="Delete uploaded and processed video files from server storage"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Clear Session</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
