/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import {
  Zap,
  RefreshCw,
  AlertTriangle,
  FileVideo,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { DropZone } from './components/DropZone.tsx';
import { StreamInspector } from './components/StreamInspector.tsx';
import { CompatibilityAlert } from './components/CompatibilityAlert.tsx';
import { RemuxSettings } from './components/RemuxSettings.tsx';
import { ProgressCard } from './components/ProgressCard.tsx';
import { ComparisonView } from './components/ComparisonView.tsx';
import { EducationalModal } from './components/EducationalModal.tsx';
import { SetupInstructionsModal } from './components/SetupInstructionsModal.tsx';
import type {
  HealthStatus,
  SampleClip,
  ProbeMetadata,
  CompatibilityReport,
  RemuxOptions,
  JobState
} from './types.ts';

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [samples, setSamples] = useState<SampleClip[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [maxUploadSizeMB, setMaxUploadSizeMB] = useState<number>(2048);

  // Active Session State
  const [jobId, setJobId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [inputMetadata, setInputMetadata] = useState<ProbeMetadata | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityReport | null>(null);

  // Remux settings & job progress
  const [remuxOptions, setRemuxOptions] = useState<RemuxOptions>({
    targetContainer: 'mp4',
    faststart: true,
    stripMetadata: false,
    optimizeColorTags: true
  });
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  // Modals
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // SSE EventSource reference
  const sseRef = useRef<EventSource | null>(null);

  // Fallback polling interval reference
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Fetch Health, Config, and Generate Samples on mount
  useEffect(() => {
    fetchHealth();
    fetchConfig();
    initSamples();

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.maxUploadSizeMB) {
          setMaxUploadSizeMB(data.maxUploadSizeMB);
        }
      }
    } catch (e) {
      console.warn('Config endpoint unreachable:', e);
    }
  };

  const handleUpdateLimit = async (newLimitMB: number) => {
    setMaxUploadSizeMB(newLimitMB);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitMB: newLimitMB })
      });
    } catch (e) {
      console.error('Failed to update upload limit on server:', e);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (e) {
      console.warn('Health check not reachable yet:', e);
    }
  };

  const initSamples = async () => {
    try {
      const res = await fetch('/api/samples/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.samples) {
          setSamples(data.samples);
        }
      }
    } catch (e) {
      console.warn('Could not initialize test samples:', e);
    }
  };

  // 2. Upload file handler
  const handleFileSelected = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(15);
    setAppError(null);
    clearSessionState();

    const formData = new FormData();
    formData.append('video', file);

    try {
      setUploadProgress(45);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      setUploadProgress(90);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload and inspect file.');
      }

      setJobId(data.jobId);
      setFilename(data.filename);
      setInputMetadata(data.metadata);
      setCompatibility(data.compatibility);
      setUploadProgress(100);
    } catch (err: any) {
      setAppError(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 3. Load sample clip
  const handleSampleSelected = async (sampleId: string) => {
    setIsUploading(true);
    setUploadProgress(30);
    setAppError(null);
    clearSessionState();

    try {
      const res = await fetch(`/api/samples/load/${sampleId}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load sample clip.');
      }

      setJobId(data.jobId);
      setFilename(data.filename);
      setInputMetadata(data.metadata);
      setCompatibility(data.compatibility);
    } catch (err: any) {
      setAppError(err.message || 'Failed to load sample');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 4. Update container option & re-check compatibility
  const handleOptionsChange = async (newOptions: RemuxOptions) => {
    setRemuxOptions(newOptions);
    if (jobId && newOptions.targetContainer !== remuxOptions.targetContainer) {
      try {
        const res = await fetch(`/api/inspect/${jobId}?container=${newOptions.targetContainer}`);
        if (res.ok) {
          const data = await res.json();
          setCompatibility(data.compatibility);
        }
      } catch (e) {
        console.error('Error re-evaluating compatibility:', e);
      }
    }
  };

  // 5. Start Remuxing bitstream
  const handleStartRemux = async () => {
    if (!jobId || !compatibility?.isCompatible) return;

    setIsProcessing(true);
    setAppError(null);

    // Initial state
    setJobState({
      jobId,
      status: 'processing',
      progressPercent: 5,
      speed: 'Direct IO',
      fps: 0,
      frame: 0,
      bitrate: 'N/A'
    });

    try {
      const res = await fetch(`/api/remux/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(remuxOptions)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Remux execution failed.');
      }

      // Connect to Server-Sent Events (SSE) for live stream progress
      if (sseRef.current) {
        sseRef.current.close();
      }

      const sse = new EventSource(`/api/remux-progress/${jobId}`);
      sseRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setJobState((prev) => ({
            ...prev,
            jobId,
            status: parsed.status,
            progressPercent: parsed.progressPercent,
            speed: parsed.speed,
            fps: parsed.fps,
            frame: parsed.frame,
            bitrate: parsed.bitrate,
            error: parsed.error,
            comparison: parsed.comparison,
            outputMetadata: parsed.outputMetadata,
            outputFilename: `${filename.replace(/\.[^/.]+$/, '')}_clearframe.${remuxOptions.targetContainer}`
          }));

          if (parsed.status === 'completed') {
            setIsProcessing(false);
            sse.close();
            sseRef.current = null;
            // Fetch final verified data
            fetch(`/api/job/${jobId}`)
              .then((r) => r.json())
              .then((finalJob) => {
                if (finalJob) {
                  setJobState((prev) => ({
                    ...prev,
                    ...finalJob,
                    outputFilename: finalJob.outputFilename || `${filename.replace(/\.[^/.]+$/, '')}_clearframe.${remuxOptions.targetContainer}`
                  }));
                }
              })
              .catch((err) => console.error('Error fetching final job status:', err));
          } else if (parsed.status === 'failed') {
            setIsProcessing(false);
            sse.close();
            sseRef.current = null;
          }
        } catch (e) {
          console.error('Error parsing SSE progress:', e);
        }
      };

      sse.onerror = () => {
        // Fallback polling if SSE is interrupted
        pollJobStatus(jobId);
        sse.close();
        sseRef.current = null;
      };
    } catch (err: any) {
      setIsProcessing(false);
      setAppError(err.message || 'Failed to start remux process');
      setJobState((prev) => prev ? { ...prev, status: 'failed', error: err.message } : null);
    }
  };

  // Fallback poller
  const pollJobStatus = async (id: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/job/${id}`);
        if (res.ok) {
          const data = await res.json();
          setJobState(data);
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            setIsProcessing(false);
          }
        }
      } catch (e) {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsProcessing(false);
      }
    }, 400);
  };

  // 6. Clear session state & server files
  const clearSessionState = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (jobId) {
      fetch(`/api/session/${jobId}`, { method: 'DELETE' }).catch(() => { });
    }
    setJobId(null);
    setFilename('');
    setInputMetadata(null);
    setCompatibility(null);
    setJobState(null);
    setIsProcessing(false);
    setAppError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top App Header */}
      <Header
        health={health}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSetup={() => setIsSetupOpen(true)}
        hasActiveJob={!!jobId}
        onClearSession={clearSessionState}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/40 to-slate-950/80 p-6 sm:p-10 shadow-2xl backdrop-blur-md">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <Zap className="h-3.5 w-3.5" />
                <span>Lossless Stream Copying Engine (FFmpeg & FFprobe)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>4K UHD (3840×2160) & Original Quality</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Prepare pristine video for social media{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">
                without quality loss.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Inspect video and audio streams via binary FFprobe. Remux MP4 and MOV files using direct packet copying (<code className="px-1.5 py-0.5 rounded bg-slate-950 text-blue-300 font-mono text-xs">-c copy</code>) and FastStart atom relocation. 0% preliminary generation loss. Zero downscaling of 4K UHD or master files.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Zero Downscaling & Zero Re-encoding</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Disk-Based Streaming (RAM Safe)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Pre-Download Bitstream Verification</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-blue-400" />
                <span>Command-Injection Safe</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {appError && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{appError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAppError(null)}
              className="text-rose-400 hover:text-white font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Upload Zone (Visible if no video is active or in addition to active session) */}
        {!jobId ? (
          <DropZone
            onFileSelected={handleFileSelected}
            onSampleSelected={handleSampleSelected}
            samples={samples}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            maxUploadSizeMB={maxUploadSizeMB}
            onUpdateLimit={handleUpdateLimit}
          />
        ) : (
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-800 bg-slate-900/40 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FileVideo className="h-4 w-4" />
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Active Video Session:</span>
                <span className="font-semibold text-white truncate max-w-sm block">
                  {filename}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSessionState}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Choose Different Video</span>
              </button>
            </div>
          </div>
        )}

        {/* Active Inspection & Remux Workflow */}
        {inputMetadata && compatibility && (
          <div className="space-y-6">
            {/* FFprobe Stream Breakdown */}
            <StreamInspector metadata={inputMetadata} title="Source Video Stream Inspection (FFprobe)" />

            {/* Compatibility Assessment Banner */}
            <CompatibilityAlert
              compatibility={compatibility}
              onOpenGuide={() => setIsGuideOpen(true)}
            />

            {/* Remux Configuration & Execution Panel */}
            <RemuxSettings
              options={remuxOptions}
              onOptionsChange={handleOptionsChange}
              compatibility={compatibility}
              onStartRemux={handleStartRemux}
              isProcessing={isProcessing}
            />

            {/* Live Progress Card */}
            {jobState && (
              <ProgressCard job={jobState} />
            )}

            {/* Side-by-Side Comparison & Download View (when completed) */}
            {jobState?.status === 'completed' && jobState.comparison && jobState.outputMetadata && (
              <ComparisonView
                jobId={jobId!}
                comparison={jobState.comparison}
                inputMetadata={inputMetadata}
                outputMetadata={jobState.outputMetadata}
                outputFilename={jobState.outputFilename || 'clearframe_remuxed.mp4'}
                onClearSession={clearSessionState}
              />
            )}
          </div>
        )}
      </main>

      {/* App Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-8 text-xs text-slate-500 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-bold text-slate-300">ClearFrame</span>
              <span>— Lossless Video Remuxer & Stream Inspector</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Powered by native FFmpeg & FFprobe stream copying. Built with React & Node.js.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Social Media Realities
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setIsSetupOpen(true)}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Host Setup & Deploy
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <EducationalModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <SetupInstructionsModal isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} />
    </div>
  );
}
