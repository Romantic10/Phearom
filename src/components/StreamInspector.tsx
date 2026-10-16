import {
  Film,
  Volume2,
  Maximize2,
  Activity,
  Layers,
  Clock,
  HardDrive,
  Gauge,
  Zap,
  Info
} from 'lucide-react';
import type { ProbeMetadata } from '../types.ts';
import {
  formatBytes,
  formatDuration,
  formatFps,
  formatBitrate,
  getResolutionTier
} from '../utils/remux-logic.ts';

interface StreamInspectorProps {
  metadata: ProbeMetadata;
  title?: string;
  isRemuxed?: boolean;
}

export const StreamInspector: React.FC<StreamInspectorProps> = ({
  metadata,
  title = 'Input Stream Inspection (FFprobe)',
  isRemuxed = false
}) => {
  const video = metadata.videoStream;
  const audio = metadata.audioStream;
  const fps = formatFps(video?.avg_frame_rate || video?.r_frame_rate);

  // Aspect ratio helper
  const getAspectRatio = (w?: number, h?: number) => {
    if (!w || !h) return '';
    const ratio = (w / h).toFixed(2);
    if (ratio === '0.56') return '9:16 (Vertical)';
    if (ratio === '1.78') return '16:9 (Widescreen)';
    if (ratio === '1.00') return '1:1 (Square)';
    if (ratio === '0.80') return '4:5 (Portrait)';
    return `${w}:${h}`;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center ${
              isRemuxed
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
            }`}
          >
            <Film className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span>{title}</span>
              {isRemuxed && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  Preserved Stream
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-md" title={metadata.filename}>
              {metadata.filename}
            </p>
          </div>
        </div>

        {/* FastStart Pill */}
        <div className="flex items-center gap-2">
          {metadata.hasFastStart ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-800/60">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              FastStart Enabled (Moov at Header)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/50 text-amber-300 border border-amber-800/60">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Moov Atom at File End (Non-optimized)
            </span>
          )}
        </div>
      </div>

      {/* Primary Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <HardDrive className="h-3.5 w-3.5 text-slate-500" />
            <span>Container Size</span>
          </div>
          <div className="text-base font-bold text-white tracking-tight">
            {formatBytes(metadata.size)}
          </div>
          <div className="text-[10px] text-slate-500 uppercase mt-0.5 truncate">
            {metadata.format_name}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Duration</span>
          </div>
          <div className="text-base font-bold text-white tracking-tight">
            {formatDuration(metadata.duration)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {metadata.duration.toFixed(2)} seconds
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Maximize2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Resolution & Tier</span>
          </div>
          <div className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>{video ? `${video.width}×${video.height}` : 'No Video'}</span>
            {video?.width && video?.height && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                video.width >= 3840 || video.height >= 2160
                  ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-700/80'
                  : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
              }`}>
                {getResolutionTier(video.width, video.height)}
              </span>
            )}
          </div>
          <div className="text-[10px] text-blue-400 font-medium mt-0.5">
            {getAspectRatio(video?.width, video?.height)} · Zero Downscaling
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Gauge className="h-3.5 w-3.5 text-slate-500" />
            <span>Frame Rate</span>
          </div>
          <div className="text-base font-bold text-white tracking-tight">
            {fps} <span className="text-xs font-normal text-slate-400">fps</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {video?.r_frame_rate || 'Constant'}
          </div>
        </div>
      </div>

      {/* Stream Breakdown: Video & Audio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Video Stream Card */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-blue-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Video Track
              </h4>
            </div>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-900/60 uppercase">
              {video?.codec_name || 'None'}
            </span>
          </div>

          {video ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Codec Full Name</span>
                <span className="text-slate-200 font-medium truncate block" title={video.codec_long_name}>
                  {video.codec_long_name || video.codec_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Profile</span>
                <span className="text-slate-200 font-medium">
                  {video.profile || 'Baseline/Main'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Pixel Format / Chroma</span>
                <span className="text-slate-200 font-mono font-medium">
                  {video.pix_fmt || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Bitrate</span>
                <span className="text-slate-200 font-medium">
                  {formatBitrate(video.bit_rate || metadata.bit_rate)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Color Space</span>
                <span className="text-slate-200 font-medium">
                  {video.color_space || 'bt709 (Standard HD)'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Color Primaries</span>
                <span className="text-slate-200 font-medium">
                  {video.color_primaries || 'bt709 / sRGB'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-400 py-2">No video track present in container.</div>
          )}
        </div>

        {/* Audio Stream Card */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-cyan-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Audio Track
              </h4>
            </div>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-900/60 uppercase">
              {audio?.codec_name || 'None'}
            </span>
          </div>

          {audio ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Audio Codec</span>
                <span className="text-slate-200 font-medium truncate block" title={audio.codec_long_name}>
                  {audio.codec_long_name || audio.codec_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Sample Rate</span>
                <span className="text-slate-200 font-medium">
                  {audio.sample_rate ? `${audio.sample_rate} Hz` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Channels</span>
                <span className="text-slate-200 font-medium">
                  {audio.channels === 2 ? 'Stereo (2 ch)' : audio.channels === 1 ? 'Mono (1 ch)' : `${audio.channels} Channels`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Audio Bitrate</span>
                <span className="text-slate-200 font-medium">
                  {formatBitrate(audio.bit_rate)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-2 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-slate-500" />
              <span>Silent video (no audio stream).</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
