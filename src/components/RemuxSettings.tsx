import { Sliders, Zap, ShieldCheck, Play, Instagram, Video, Share2 } from 'lucide-react';
import type { RemuxOptions, CompatibilityReport } from '../types.ts';

interface RemuxSettingsProps {
  options: RemuxOptions;
  onOptionsChange: (newOptions: RemuxOptions) => void;
  compatibility: CompatibilityReport;
  onStartRemux: () => void;
  isProcessing: boolean;
}

export const RemuxSettings: React.FC<RemuxSettingsProps> = ({
  options,
  onOptionsChange,
  compatibility,
  onStartRemux,
  isProcessing
}) => {
  const isCompatible = compatibility.isCompatible;

  const presets = [
    {
      id: 'reels',
      name: 'Instagram Reels',
      icon: Instagram,
      container: 'mp4' as const,
      desc: 'Optimizes MP4 with FastStart & Rec.709 color tags for seamless app ingestion'
    },
    {
      id: 'tiktok',
      name: 'TikTok Video',
      icon: Video,
      container: 'mp4' as const,
      desc: 'Bit-perfect MP4 stream copy preventing double-lossy compression artifacts'
    },
    {
      id: 'shorts',
      name: 'YouTube Shorts',
      icon: Share2,
      container: 'mp4' as const,
      desc: 'Standardized ISO-BMFF container with frontloaded moov atom for 4K/1080p'
    }
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Sliders className="h-5 w-5 text-blue-400" />
          <h3 className="text-base font-semibold text-white">
            Remux Configuration & Web Optimization
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Stream Copy (<code className="text-blue-300 font-mono">-c copy</code>)
        </span>
      </div>

      {/* Target Container Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Target Container Format
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onOptionsChange({ ...options, targetContainer: 'mp4' })}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              options.targetContainer === 'mp4'
                ? 'border-blue-500 bg-blue-950/40 text-white shadow-sm shadow-blue-500/20'
                : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">MP4 (ISO-BMFF)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-semibold">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Universal web & social media container (TikTok, Instagram, YouTube, X).
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOptionsChange({ ...options, targetContainer: 'mov' })}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              options.targetContainer === 'mov'
                ? 'border-blue-500 bg-blue-950/40 text-white shadow-sm shadow-blue-500/20'
                : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">QuickTime MOV</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                Apple Ecosystem
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              QuickTime container supporting multi-track studio audio and editing workflows.
            </p>
          </button>
        </div>
      </div>

      {/* Social Platform Quick Recommendations */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Social Platform Profile Guides
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {presets.map((preset) => {
            const Icon = preset.icon;
            return (
              <div
                key={preset.id}
                className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-200">{preset.name}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {preset.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stream Toggles */}
      <div className="space-y-3 pt-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Lossless Optimization Flags
        </label>

        <div className="space-y-2">
          {/* FastStart Toggle */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-950/80 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={options.faststart}
              onChange={(e) => onOptionsChange({ ...options, faststart: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Enable FastStart (<code className="text-blue-300 text-[11px] font-mono">-movflags +faststart</code>)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-medium">
                  Essential for Web
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Relocates the MP4 index (<code className="text-slate-300 font-mono">moov</code> atom) from the end of the file to the very beginning. Allows instant playback buffering without waiting for the full video to download.
              </p>
            </div>
          </label>

          {/* Strip Private Metadata */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-950/80 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={options.stripMetadata}
              onChange={(e) => onOptionsChange({ ...options, stripMetadata: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900"
            />
            <div className="flex-1">
              <span className="text-xs font-semibold text-slate-200">
                Strip Proprietary / Camera Exif Tags (<code className="text-blue-300 text-[11px] font-mono">-map_metadata -1</code>)
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cleans proprietary camera gyro, GPS, or non-standard metadata tracks that occasionally trigger processing errors on social media ingestion servers.
              </p>
            </div>
          </label>

          {/* Preserve Color Tags */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-950/80 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={options.optimizeColorTags}
              onChange={(e) => onOptionsChange({ ...options, optimizeColorTags: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900"
            />
            <div className="flex-1">
              <span className="text-xs font-semibold text-slate-200">
                Preserve Native Color Primaries & Matrix (BT.709 / sRGB)
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Maintains accurate container color descriptors to prevent social media apps from washing out contrast or tinting skin tones during their transcoder step.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Original Quality & 4K Integrity Notice */}
      <div className="p-3.5 rounded-xl border border-blue-900/40 bg-blue-950/20 flex items-start gap-2.5 text-xs text-blue-200">
        <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-white">Original Quality Guarantee</span>
          <p className="text-[11px] text-blue-300/80">
            ClearFrame never silently reduces video quality, lowers bitrate, or downscales 4K UHD (3840×2160) to 1080p to fit a container. Video and audio packets are copied bit-for-bit.
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onStartRemux}
          disabled={!isCompatible || isProcessing}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
            isCompatible && !isProcessing
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 active:scale-[0.99]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50 shadow-none'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Remuxing Bitstream (Stream Copying)...</span>
            </>
          ) : isCompatible ? (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>Lossless Remux Stream (Zero Re-encoding)</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              <span>Cannot Remux Incompatible Codec</span>
            </>
          )}
        </button>

        {!isCompatible && (
          <p className="text-center text-xs text-amber-400/90 mt-2">
            ClearFrame refuses to silently re-encode. Please see the compatibility diagnosis above.
          </p>
        )}
      </div>
    </div>
  );
};
