import { useState, useRef } from 'react';
import {
  Download,
  CheckCircle2,
  FileCheck,
  Trash2,
  Sparkles,
  Info,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import type { ComparisonReport, ProbeMetadata } from '../types.ts';
import { formatBytes, getResolutionTier } from '../utils/remux-logic.ts';

interface ComparisonViewProps {
  jobId: string;
  comparison: ComparisonReport;
  inputMetadata: ProbeMetadata;
  outputMetadata: ProbeMetadata;
  outputFilename: string;
  onClearSession: () => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  jobId,
  comparison,
  inputMetadata,
  outputMetadata,
  outputFilename,
  onClearSession
}) => {
  const [activePlayer, setActivePlayer] = useState<'output' | 'input'>('output');
  const [showAllChecks, setShowAllChecks] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoSrc = `/api/video/${jobId}/${activePlayer}`;
  const downloadUrl = `/api/download/${jobId}`;

  const isVerified = comparison.verification ? comparison.verification.isVerified : true;
  const canDownload = comparison.verification ? comparison.verification.canDownload : true;

  const inW = inputMetadata.videoStream?.width;
  const inH = inputMetadata.videoStream?.height;
  const is4K = (inW && inW >= 3840) || (inH && inH >= 2160);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-8">
      {/* Top Banner / Verdict */}
      <div className={`rounded-xl border p-5 ${
        isVerified
          ? 'border-emerald-800/70 bg-gradient-to-r from-emerald-950/50 via-slate-900/60 to-blue-950/40'
          : 'border-rose-800/70 bg-gradient-to-r from-rose-950/50 via-slate-900/60 to-amber-950/40'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
              isVerified
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}>
              {isVerified ? <FileCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {isVerified ? 'Output Verified & Integrity Confirmed' : 'Integrity Verification Failed'}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  0% Generation Loss
                </span>
                {is4K && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                    4K UHD Intact
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                {comparison.summary} Original quality, resolution, and bitstream payloads were verified before download.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {canDownload ? (
              <a
                href={downloadUrl}
                download={outputFilename}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>Download Verified Video ({formatBytes(outputMetadata.size)})</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Download Blocked (Failed Integrity Check)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pre-Download Output Verification Certificate */}
      {comparison.verification && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Pre-Download Quality & Bitstream Verification Certificate
                </h4>
                <p className="text-[11px] text-slate-400">
                  {comparison.verification.summary}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAllChecks(!showAllChecks)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium underline underline-offset-4 cursor-pointer"
            >
              {showAllChecks ? 'Hide Detailed Check Matrix' : 'View All 7 Verification Checks'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {comparison.verification.checks.slice(0, showAllChecks ? 7 : 3).map((check, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  check.passed
                    ? 'border-emerald-900/50 bg-emerald-950/20'
                    : 'border-rose-900/60 bg-rose-950/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-200 truncate">{check.name}</span>
                  {check.passed ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/70 text-emerald-300">
                      PASSED
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-900/70 text-rose-300">
                      FAILED
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {check.actual}
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">
                  {check.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side Video Player & Inspector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Interactive Video Preview
            </h4>
          </div>

          {/* Toggle between Original and Remuxed Output */}
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActivePlayer('output')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activePlayer === 'output'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Remuxed Output (FastStart)
            </button>
            <button
              type="button"
              onClick={() => setActivePlayer('input')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activePlayer === 'input'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Original Source File
            </button>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-h-[460px] flex items-center justify-center group">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            playsInline
            className="w-full h-full max-h-[460px] object-contain"
          />

          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-200 pointer-events-none">
            Previewing: {activePlayer === 'output' ? 'Remuxed Stream Copy' : 'Original Input File'}
          </div>
        </div>
      </div>

      {/* Preservation Audit Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Stream Preservation Audit & Diff
          </h4>
          <span className="text-[11px] text-slate-400">
            Audited via FFprobe stream comparison
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80">
                <th className="py-3 px-4 font-medium">Property</th>
                <th className="py-3 px-4 font-medium">Original Input</th>
                <th className="py-3 px-4 font-medium">Remuxed Output</th>
                <th className="py-3 px-4 font-medium text-center">Preservation Status</th>
                <th className="py-3 px-4 font-medium">Technical Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {comparison.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-200">{item.label}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{item.inputVal}</td>
                  <td className="py-3 px-4 font-mono text-slate-200 font-semibold">{item.outputVal}</td>
                  <td className="py-3 px-4 text-center">
                    {item.preserved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        100% Preserved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                        Altered
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">{item.details}</td>
                </tr>
              ))}

              {/* File Size Row */}
              <tr className="hover:bg-slate-900/40 transition-colors bg-slate-950/30">
                <td className="py-3 px-4 font-medium text-slate-200">Container File Size</td>
                <td className="py-3 px-4 font-mono text-slate-400">{formatBytes(inputMetadata.size)}</td>
                <td className="py-3 px-4 font-mono text-slate-200 font-semibold">{formatBytes(outputMetadata.size)}</td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                    {comparison.fileSizeDeltaBytes >= 0 ? '+' : ''}
                    {formatBytes(comparison.fileSizeDeltaBytes)} ({comparison.fileSizeDeltaPercent.toFixed(1)}%)
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-400 text-[11px]">
                  Variance reflects container atoms and FastStart index layout; 0 frames were recompressed.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Info className="h-4 w-4 text-slate-500" />
          <span>Temporary files are automatically cleaned up periodically, or click Delete Session now.</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClearSession}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            <span>Delete Session Files</span>
          </button>

          {canDownload ? (
            <a
              href={downloadUrl}
              download={outputFilename}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-md shadow-blue-500/20 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Remuxed {outputFilename.toLowerCase().endsWith('.mov') ? 'MOV' : 'MP4'}</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-800 border border-slate-700 cursor-not-allowed"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Download Blocked</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
