import { useState, useRef } from 'react';
import { UploadCloud, FileVideo, Sparkles, AlertTriangle, CheckCircle2, PlayCircle } from 'lucide-react';
import type { SampleClip } from '../types.ts';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  onSampleSelected: (sampleId: string) => void;
  samples: SampleClip[];
  isUploading: boolean;
  uploadProgress: number;
  maxUploadSizeMB?: number;
  onUpdateLimit?: (newLimitMB: number) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileSelected,
  onSampleSelected,
  samples,
  isUploading,
  uploadProgress,
  maxUploadSizeMB = 2048,
  onUpdateLimit
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndProcess(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndProcess(files[0]);
    }
    e.target.value = '';
  };

  const validateAndProcess = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const validExts = ['.mp4', '.mov', '.m4v'];

    if (!validExts.includes(ext)) {
      setDragError(`Unsupported file format "${ext}". Please provide an MP4, MOV, or M4V video.`);
      return;
    }

    const maxBytes = maxUploadSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setDragError(`File exceeds maximum size limit of ${maxUploadSizeMB >= 1024 ? `${(maxUploadSizeMB / 1024).toFixed(1)} GB` : `${maxUploadSizeMB} MB`} (current: ${(file.size / (1024 * 1024)).toFixed(1)} MB). Adjust the limit below or provide a smaller file.`);
      return;
    }

    setDragError(null);
    onFileSelected(file);
  };

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center transition-all cursor-pointer select-none ${
          isDragOver
            ? 'border-blue-400 bg-blue-950/30 scale-[1.01]'
            : 'border-slate-800 bg-slate-900/50 hover:border-blue-500/50 hover:bg-slate-900/80'
        } ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.m4v,video/mp4,video/quicktime"
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto animate-pulse">
              <UploadCloud className="h-7 w-7 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Streaming Video to Disk & Inspecting...</h3>
              <p className="text-xs text-slate-400 mt-1">Direct disk-based streaming prevents RAM exhaustion for 4K UHD and master files</p>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                style={{ width: `${uploadProgress || 65}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto shadow-inner shadow-blue-500/10">
              <UploadCloud className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Drop your video here, or <span className="text-blue-400 underline underline-offset-4">browse files</span>
              </h3>
              <p className="text-sm text-slate-400 mt-1.5 max-w-lg mx-auto">
                Losslessly remux MP4 and MOV containers. Accepts original quality 4K UHD (3840×2160), 1080p, and multi-track audio without downscaling or compression.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                <FileVideo className="h-3 w-3 text-blue-400" />
                4K UHD (3840×2160) & 1080p
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Zero Downscaling Guarantee
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
                Disk Streaming: Up to {maxUploadSizeMB >= 1024 ? `${(maxUploadSizeMB / 1024).toFixed(0)} GB` : `${maxUploadSizeMB} MB`}
              </span>
            </div>
          </div>
        )}

        {dragError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/70 text-rose-200 text-xs flex items-center gap-2 max-w-md mx-auto">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{dragError}</span>
          </div>
        )}
      </div>

      {/* Upload Size Ceiling & Disk Streaming Setting */}
      {onUpdateLimit && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-800/80 bg-slate-900/30 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-semibold text-slate-200">Upload Size Limit:</span>
            <span className="text-slate-400">
              {maxUploadSizeMB >= 1024 ? `${(maxUploadSizeMB / 1024).toFixed(0)} GB` : `${maxUploadSizeMB} MB`} (Streaming to Disk · RAM Safe)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {[500, 1024, 2048, 4096].map((limitVal) => {
              const label = limitVal >= 1024 ? `${limitVal / 1024} GB` : `${limitVal} MB`;
              const isSelected = maxUploadSizeMB === limitVal;
              return (
                <button
                  key={limitVal}
                  type="button"
                  onClick={() => onUpdateLimit(limitVal)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Test Samples Selector */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Or Test Instantly With Real Test Clips
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Includes 4K UHD 60fps & 1080p clips · Real FFmpeg generated samples
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {samples.map((sample) => {
            const isCompatible = sample.type === 'compatible';
            const is4K = sample.id.includes('4k');
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSampleSelected(sample.id)}
                disabled={isUploading}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all text-xs group cursor-pointer ${
                  is4K
                    ? 'border-indigo-500/40 bg-indigo-950/20 hover:border-indigo-400 hover:bg-indigo-950/40'
                    : isCompatible
                    ? 'border-slate-800 bg-slate-900/80 hover:border-blue-500/60 hover:bg-slate-850'
                    : 'border-slate-800 bg-slate-900/80 hover:border-amber-500/60 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                    {sample.title}
                  </span>
                  <PlayCircle className="h-4 w-4 text-slate-500 group-hover:text-blue-400 shrink-0 transition-colors" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {sample.description}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span
                    className={
                      is4K
                        ? 'text-cyan-400 font-bold'
                        : isCompatible
                        ? 'text-emerald-400 font-medium'
                        : 'text-amber-400 font-medium'
                    }
                  >
                    {is4K ? '4K UHD (3840×2160)' : isCompatible ? 'Lossless Compatible' : 'Incompatible Codec Test'}
                  </span>
                  <span className="text-blue-400 group-hover:underline">Load Clip →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
