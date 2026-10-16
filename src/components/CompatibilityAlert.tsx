import { ShieldCheck, AlertOctagon, HelpCircle, ArrowRight } from 'lucide-react';
import type { CompatibilityReport } from '../types.ts';

interface CompatibilityAlertProps {
  compatibility: CompatibilityReport;
  onOpenGuide: () => void;
}

export const CompatibilityAlert: React.FC<CompatibilityAlertProps> = ({
  compatibility,
  onOpenGuide
}) => {
  if (compatibility.isCompatible) {
    return (
      <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/30 p-5 backdrop-blur-sm">
        <div className="flex items-start gap-3.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-emerald-200">
                100% Lossless Stream-Copy Compatible
              </h4>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                0% Generation Loss
              </span>
            </div>
            <p className="text-xs text-emerald-300/80 leading-relaxed">
              Input video and audio streams are fully standard for the target {compatibility.targetContainer.toUpperCase()} container.
              ClearFrame will remux the bitstream via direct packet copy (<code className="px-1 py-0.5 rounded bg-emerald-950 text-emerald-200 font-mono text-[11px]">-c copy</code>) without recompressing a single pixel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-800/80 bg-amber-950/40 p-5 backdrop-blur-sm space-y-3">
      <div className="flex items-start gap-3.5">
        <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
          <AlertOctagon className="h-5 w-5" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-amber-200">
              Lossless Remux Not Feasible (Zero-Silent-Reencode Policy)
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-900/70 text-amber-300 border border-amber-700/60">
              Stream Incompatible
            </span>
          </div>

          <p className="text-xs text-amber-200/90 leading-relaxed">
            ClearFrame adheres strictly to honest media processing: <strong className="text-white">we will never silently re-encode or compress your video</strong>.
            The input contains streams that cannot be packaged into an {compatibility.targetContainer.toUpperCase()} container without converting them:
          </p>

          <ul className="space-y-1.5 pt-1">
            {compatibility.reasons.map((reason, idx) => (
              <li
                key={idx}
                className="text-xs text-amber-200/80 bg-amber-950/60 border border-amber-900/60 rounded-lg p-2.5 flex items-start gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 italic">
              {compatibility.recommendation}
            </span>
            <button
              type="button"
              onClick={onOpenGuide}
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium underline underline-offset-4 cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Learn why platforms require specific codecs</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
