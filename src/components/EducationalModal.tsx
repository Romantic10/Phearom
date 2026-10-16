import { X, BookOpen, AlertCircle, Shield, Zap, Film } from 'lucide-react';

interface EducationalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EducationalModal: React.FC<EducationalModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                ClearFrame Technical Guide & Social Media Realities
              </h3>
              <p className="text-xs text-slate-400">
                Understanding lossless remuxing, FastStart atom shifting, and platform transcoders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content sections */}
        <div className="space-y-6 text-xs text-slate-300 leading-relaxed">
          {/* Section 1: Remuxing vs Re-encoding */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Film className="h-4 w-4 text-blue-400" />
              <span>Remuxing vs. Re-encoding: Why Zero Generation Loss Matters</span>
            </h4>
            <p>
              When video editing software or traditional converters export a file, they decode every compressed frame and recompress it through an encoder (like x264 or NVENC). Every pass compounds <strong>generational loss</strong>—destroying fine grain, smoothing skin details, and inducing macroblocking.
            </p>
            <p>
              <strong>Lossless remuxing</strong> performs stream copying (<code className="px-1.5 py-0.5 rounded bg-slate-950 text-blue-300 font-mono">-c copy</code>). The compressed video NAL units and audio packets are lifted directly out of the source container (e.g. MOV) and placed unaltered into a standardized MP4 container. Zero pixels are re-quantized.
            </p>
          </div>

          {/* Section 2: Honest Truth on Social Platforms */}
          <div className="p-4 rounded-xl border border-amber-800/70 bg-amber-950/30 space-y-2 text-amber-200/90">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Critical Truth: What Happens During Social Media Uploads</span>
            </div>
            <p>
              ClearFrame does <strong>not</strong> make false promises: no tool can bypass TikTok, Instagram, or YouTube's internal transcoders or guarantee that they will serve your original 50 Mbps file to mobile viewers.
            </p>
            <p>
              Platforms <strong className="text-white">always re-encode uploaded media</strong> into multi-bitrate HLS/DASH streams (e.g., 720p, 1080p, AV1, VP9).
            </p>
            <p>
              However, starting with a clean, stream-copied MP4 ensures the platform's ingest pipeline receives a <strong>pristine first-generation master</strong> without double compression artifacts, audio sync drift, or non-standard container flags that degrade final transcode quality.
            </p>
          </div>

          {/* Section 3: FastStart (Moov Front) */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Why FastStart (<code className="font-mono text-xs text-blue-300">+faststart</code>) is Essential</span>
            </h4>
            <p>
              In ISO-BMFF MP4 files, the <code className="px-1 py-0.5 rounded bg-slate-950 text-blue-300 font-mono">moov</code> atom is the master index containing sample tables, durations, and keyframe offsets. By default, video cameras and editing tools append the <code className="font-mono text-slate-300">moov</code> atom at the <em>end</em> of the file after writing all media frames (<code className="font-mono text-slate-300">mdat</code>).
            </p>
            <p>
              For web playback or social platform processing, this means the server or browser cannot decode the first frame until 100% of the video bytes are downloaded. Enabling <code className="font-mono text-blue-300">+faststart</code> relocates the <code className="font-mono text-blue-300">moov</code> atom to byte 0, enabling instantaneous streaming playback.
            </p>
          </div>

          {/* Section 4: Security & Zero Command Injection */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Zero-Injection Security Architecture</span>
            </h4>
            <p>
              ClearFrame never executes user-supplied filenames through a shell. Every FFmpeg and FFprobe invocation utilizes Node's safe <code className="font-mono text-slate-300">execFile</code> or <code className="font-mono text-slate-300">spawn</code> with strict array-based argument vectors. Files are sanitized with randomized UUIDs in ephemeral storage and automatically scrubbed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
