import type {
  ProbeMetadata,
  CompatibilityReport,
  ComparisonReport,
  VideoStreamInfo,
  AudioStreamInfo,
  VerificationCheck,
  OutputVerification
} from './utils/remux-logic.ts';

export type {
  ProbeMetadata,
  CompatibilityReport,
  ComparisonReport,
  VideoStreamInfo,
  AudioStreamInfo,
  VerificationCheck,
  OutputVerification
};

export interface SystemConfig {
  maxUploadSizeMB: number;
  maxUploadSizeBytes: number;
  supports4KUHD: boolean;
  storageMethod: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded';
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegVersion: string;
  ffprobeVersion: string;
  uptimeSeconds: number;
}

export interface SampleClip {
  id: string;
  title: string;
  description: string;
  type: 'compatible' | 'incompatible';
}

export interface RemuxOptions {
  targetContainer: 'mp4' | 'mov';
  faststart: boolean;
  stripMetadata: boolean;
  optimizeColorTags: boolean;
}

export interface JobState {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progressPercent: number;
  speed: string;
  fps: number;
  frame: number;
  bitrate: string;
  error?: string;
  outputFilename?: string;
  comparison?: ComparisonReport;
  outputMetadata?: ProbeMetadata;
}
