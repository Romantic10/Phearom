process.env.DISABLE_HMR = 'true';

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile, spawn } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  checkRemuxCompatibility,
  compareMetadata,
  parseFfmpegProgressLine,
  type ProbeMetadata
} from './src/utils/remux-logic.ts';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Cross-platform FFmpeg/FFprobe binary resolution
function findBinary(name: string): string {
  // Allow override via environment variables
  const envKey = name.toUpperCase() + '_PATH';
  if (process.env[envKey] && fs.existsSync(process.env[envKey]!)) {
    return process.env[envKey]!;
  }

  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const result = execFileSync(cmd, [name], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstLine = result.split(/\r?\n/)[0];
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
  } catch {}

  // On Windows, check common installation paths (WinGet, Chocolatey, Scoop, Program Files)
  if (process.platform === 'win32') {
    const exeName = name.endsWith('.exe') ? name : `${name}.exe`;
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const userProfile = process.env.USERPROFILE || '';

    const candidates = [
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', exeName),
      path.join(programData, 'chocolatey', 'bin', exeName),
      path.join(userProfile, 'scoop', 'shims', exeName),
      path.join('C:\\ffmpeg', 'bin', exeName),
      path.join(programFiles, 'ffmpeg', 'bin', exeName),
      path.join(programFiles, 'BlueStacks_nxt', exeName)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Also check WinGet Packages directory recursively if present
    const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetPackages)) {
      try {
        const pkgs = fs.readdirSync(wingetPackages);
        for (const pkg of pkgs) {
          if (pkg.toLowerCase().includes('ffmpeg')) {
            const pkgDir = path.join(wingetPackages, pkg);
            const findInDir = (dir: string, depth: number): string | null => {
              if (depth <= 0) return null;
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isFile() && entry.name.toLowerCase() === exeName.toLowerCase()) {
                  return fullPath;
                }
                if (entry.isDirectory()) {
                  const found = findInDir(fullPath, depth - 1);
                  if (found) return found;
                }
              }
              return null;
            };
            const foundExe = findInDir(pkgDir, 3);
            if (foundExe) return foundExe;
          }
        }
      } catch {}
    }
  }

  // Fall back to bare command name (relies on PATH)
  return name;
}

const FFMPEG_BIN = findBinary('ffmpeg');
const FFPROBE_BIN = findBinary('ffprobe');

// Storage directories
const UPLOADS_DIR = path.join(__dirname, 'temp_storage', 'uploads');
const PROCESSED_DIR = path.join(__dirname, 'temp_storage', 'processed');
const SAMPLES_DIR = path.join(__dirname, 'temp_storage', 'samples');

for (const dir of [UPLOADS_DIR, PROCESSED_DIR, SAMPLES_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// In-memory active job states for live progress tracking
interface RemuxJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progressPercent: number;
  speed: string;
  fps: number;
  frame: number;
  bitrate: string;
  error?: string;
  inputPath: string;
  outputPath?: string;
  inputMetadata?: ProbeMetadata;
  outputMetadata?: ProbeMetadata;
  comparison?: any;
  filename: string;
  outputFilename?: string;
  createdAt: number;
}

const activeJobs = new Map<string, RemuxJob>();

// Multer storage with UUID-based safe naming to prevent path traversal
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.mp4', '.mov', '.m4v'].includes(ext) ? ext : '.mp4';
    const uniqueId = crypto.randomUUID();
    cb(null, `${uniqueId}${safeExt}`);
  }
});

// Configurable upload size limit (Default: 2048 MB / 2 GB, adjustable via env or /api/config)
let maxUploadSizeMB = process.env.MAX_UPLOAD_SIZE_MB
  ? parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10)
  : 2048;

const getUploadMiddleware = () =>
  multer({
    storage,
    limits: {
      fileSize: maxUploadSizeMB * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExtensions = ['.mp4', '.mov', '.m4v'];
      const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'application/octet-stream'];

      if (allowedExtensions.includes(ext) || allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${ext}. ClearFrame accepts MP4, MOV, and M4V files.`));
      }
    }
  });

app.use(express.json());

/**
 * Binary faststart detection: checks whether moov atom appears before mdat atom
 */
function checkIsFastStart(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    fs.open(filePath, 'r', (err, fd) => {
      if (err) return resolve(false);

      // Read the first 256KB to see if moov atom header is in early metadata
      const buffer = Buffer.alloc(262144);
      fs.read(fd, buffer, 0, buffer.length, 0, (readErr, bytesRead) => {
        fs.close(fd, () => {});
        if (readErr || bytesRead < 16) return resolve(false);

        // First pass: Structured ISO box parser
        let pos = 0;
        let moovPos = -1;
        let mdatPos = -1;

        while (pos + 8 <= bytesRead) {
          const atomSize = buffer.readUInt32BE(pos);
          const atomType = buffer.toString('latin1', pos + 4, pos + 8);
          if (atomType === 'moov' && moovPos === -1) {
            moovPos = pos;
          } else if (atomType === 'mdat' && mdatPos === -1) {
            mdatPos = pos;
          }
          if (moovPos !== -1 || mdatPos !== -1) {
            break;
          }
          if (atomSize === 1) {
            if (pos + 16 > bytesRead) break;
            const bigSize = Number(buffer.readBigUInt64BE(pos + 8));
            if (bigSize <= 0) break;
            pos += bigSize;
          } else if (atomSize <= 0 || atomSize < 8) {
            break;
          } else {
            pos += atomSize;
          }
        }

        if (moovPos !== -1 && mdatPos !== -1) {
          return resolve(moovPos < mdatPos);
        } else if (moovPos !== -1 && mdatPos === -1) {
          return resolve(true);
        } else if (mdatPos !== -1 && moovPos === -1) {
          return resolve(false);
        }

        // Fallback sliding search
        for (let i = 0; i < bytesRead - 8; i++) {
          const tag = buffer.toString('utf8', i + 4, i + 8);
          if (tag === 'moov' && moovPos === -1) {
            moovPos = i;
          } else if (tag === 'mdat' && mdatPos === -1) {
            mdatPos = i;
          }
        }

        if (moovPos !== -1 && mdatPos !== -1) {
          resolve(moovPos < mdatPos);
        } else if (moovPos !== -1 && mdatPos === -1) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  });
}

/**
 * Execute FFprobe safely using execFile (array arguments, zero shell injection)
 */
function probeVideoFile(filePath: string, originalFilename: string): Promise<ProbeMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-show_error',
      filePath
    ];

    execFile(FFPROBE_BIN, args, async (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`FFprobe inspection failed: ${stderr || error.message}`));
      }

      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = data.streams || [];

        const videoStream = streams.find((s: any) => s.codec_type === 'video');
        const audioStream = streams.find((s: any) => s.codec_type === 'audio');

        const hasFastStart = await checkIsFastStart(filePath);

        const metadata: ProbeMetadata = {
          filename: originalFilename,
          format_name: format.format_name || 'unknown',
          format_long_name: format.format_long_name || '',
          size: parseInt(format.size || '0', 10) || fs.statSync(filePath).size,
          duration: parseFloat(format.duration || '0'),
          bit_rate: parseInt(format.bit_rate || '0', 10),
          streams,
          videoStream,
          audioStream,
          hasFastStart
        };

        resolve(metadata);
      } catch (parseErr: any) {
        reject(new Error(`Failed to parse FFprobe output: ${parseErr.message}`));
      }
    });
  });
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// System Health & FFmpeg Check
app.get('/api/health', (_req: Request, res: Response) => {
  execFile(FFMPEG_BIN, ['-version'], (ffmpegErr, ffmpegOut) => {
    execFile(FFPROBE_BIN, ['-version'], (probeErr, probeOut) => {
      const ffmpegVersion = ffmpegOut ? ffmpegOut.split('\n')[0].trim() : 'Not found';
      const ffprobeVersion = probeOut ? probeOut.split('\n')[0].trim() : 'Not found';

      res.json({
        status: !ffmpegErr && !probeErr ? 'healthy' : 'degraded',
        ffmpegAvailable: !ffmpegErr,
        ffprobeAvailable: !probeErr,
        ffmpegVersion,
        ffprobeVersion,
        serverTime: new Date().toISOString(),
        uploadsDir: UPLOADS_DIR,
        uptimeSeconds: Math.floor(process.uptime())
      });
    });
  });
});

// Get system upload configuration and disk streaming limits
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    maxUploadSizeMB,
    maxUploadSizeBytes: maxUploadSizeMB * 1024 * 1024,
    supports4KUHD: true,
    storageMethod: 'Direct disk-based streaming (RAM-safe, zero downscaling)',
    minUploadSizeMB: 100,
    maxAllowedSizeMB: 4096
  });
});

// Adjust upload size limit
app.post('/api/config', (req: Request, res: Response) => {
  const { limitMB } = req.body;
  const parsed = parseInt(limitMB, 10);
  if (isNaN(parsed) || parsed < 50 || parsed > 8192) {
    return res.status(400).json({ error: 'Limit must be between 50 MB and 8192 MB (8 GB).' });
  }
  maxUploadSizeMB = parsed;
  res.json({
    message: `Upload limit updated to ${maxUploadSizeMB} MB`,
    maxUploadSizeMB,
    maxUploadSizeBytes: maxUploadSizeMB * 1024 * 1024
  });
});

// File Upload endpoint with dynamic streaming limit
app.post('/api/upload', (req: Request, res: Response, next: NextFunction) => {
  getUploadMiddleware().single('video')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `File exceeds the maximum upload size of ${maxUploadSizeMB >= 1024 ? `${(maxUploadSizeMB / 1024).toFixed(1)} GB` : `${maxUploadSizeMB} MB`}. Adjust the limit in settings or provide a smaller file.`
        });
      }
      return next(err);
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded.' });
  }

  const uploadedFile = req.file;
  const jobId = path.basename(uploadedFile.filename, path.extname(uploadedFile.filename));

  try {
    const metadata = await probeVideoFile(uploadedFile.path, uploadedFile.originalname);
    const compatibility = checkRemuxCompatibility(metadata, 'mp4');

    const job: RemuxJob = {
      id: jobId,
      status: 'pending',
      progressPercent: 0,
      speed: '0x',
      fps: 0,
      frame: 0,
      bitrate: 'N/A',
      inputPath: uploadedFile.path,
      inputMetadata: metadata,
      filename: uploadedFile.originalname,
      createdAt: Date.now()
    };

    activeJobs.set(jobId, job);

    res.json({
      jobId,
      filename: uploadedFile.originalname,
      metadata,
      compatibility
    });
  } catch (err: any) {
    // Clean up uploaded file if inspection fails
    if (fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }
    res.status(500).json({ error: err.message || 'Failed to inspect uploaded video.' });
  }
});

// Inspect existing file by jobId
app.get('/api/inspect/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Session or video not found.' });
  }

  try {
    const metadata = await probeVideoFile(job.inputPath, job.filename);
    const targetContainer = (req.query.container as 'mp4' | 'mov') || 'mp4';
    const compatibility = checkRemuxCompatibility(metadata, targetContainer);

    res.json({
      jobId: id,
      filename: job.filename,
      metadata,
      compatibility
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Remuxing Job
app.post('/api/remux/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  const {
    targetContainer = 'mp4',
    faststart = true,
    stripMetadata = false,
    optimizeColorTags = true
  } = req.body;

  // Verify compatibility
  const metadata = job.inputMetadata || (await probeVideoFile(job.inputPath, job.filename));
  const compatibility = checkRemuxCompatibility(metadata, targetContainer);

  if (!compatibility.isCompatible) {
    return res.status(400).json({
      error: 'Incompatible for lossless stream-copy remuxing.',
      compatibility
    });
  }

  const outExtension = targetContainer === 'mov' ? '.mov' : '.mp4';
  const outFilename = `${id}_remuxed${outExtension}`;
  const outPath = path.join(PROCESSED_DIR, outFilename);

  // If already completed and output exists, return immediately
  if (job.status === 'completed' && job.outputPath && fs.existsSync(job.outputPath)) {
    return res.json({
      jobId: id,
      status: 'completed',
      comparison: job.comparison
    });
  }

  job.status = 'processing';
  job.outputPath = outPath;
  job.outputFilename = `clearframe_${path.basename(job.filename, path.extname(job.filename))}${outExtension}`;

  // Build FFmpeg command safely with explicit array arguments
  const args = [
    '-y',
    '-i', job.inputPath,
    // Stream copy audio and video without re-encoding!
    '-c', 'copy',
    '-map', '0:v:0',
    '-map', '0:a?'
  ];

  // Web faststart moov atom shift
  if (faststart) {
    args.push('-movflags', '+faststart');
  }

  // Strip non-standard private metadata tags if requested
  if (stripMetadata) {
    args.push('-map_metadata', '-1');
  }

  // Standard color metadata preservation flag
  if (optimizeColorTags && metadata.videoStream?.color_space) {
    // In copy mode, tags are preserved automatically in container atoms
  }

  // Pipe progress
  args.push('-progress', 'pipe:1', outPath);

  // Launch FFmpeg child process
  const ffmpegProcess = spawn(FFMPEG_BIN, args);

  let progressBuffer = '';

  ffmpegProcess.stdout.on('data', (chunk) => {
    progressBuffer += chunk.toString();
    const lastNewline = progressBuffer.lastIndexOf('\n');
    if (lastNewline !== -1) {
      const completeChunk = progressBuffer.slice(0, lastNewline);
      progressBuffer = progressBuffer.slice(lastNewline + 1);

      const parsed = parseFfmpegProgressLine(completeChunk, metadata.duration);
      job.progressPercent = parsed.progressPercent;
      job.speed = parsed.speed;
      job.fps = parsed.fps;
      job.frame = parsed.frame;
      job.bitrate = parsed.bitrate;
    }
  });

  let stderrOutput = '';
  ffmpegProcess.stderr.on('data', (chunk) => {
    stderrOutput += chunk.toString();
  });

  ffmpegProcess.on('error', (spawnErr) => {
    console.error('FFmpeg process spawn error:', spawnErr);
    job.status = 'failed';
    job.error = `FFmpeg failed to start: ${spawnErr.message}`;
    if (fs.existsSync(outPath)) {
      try { fs.unlinkSync(outPath); } catch (_) {}
    }
  });

  ffmpegProcess.on('close', async (code) => {
    if (code === 0 && fs.existsSync(outPath)) {
      try {
        const outMeta = await probeVideoFile(outPath, job.outputFilename!);
        job.outputMetadata = outMeta;
        job.comparison = compareMetadata(metadata, outMeta);
        job.progressPercent = 100;
        job.status = 'completed';
      } catch (e: any) {
        console.error('Failed to probe output:', e);
        job.status = 'failed';
        job.error = `Remux completed but failed to inspect output: ${e.message}`;
      }
    } else {
      job.status = 'failed';
      job.error = `FFmpeg remux process exited with code ${code}. ${stderrOutput.slice(-500)}`;
      if (fs.existsSync(outPath)) {
        try { fs.unlinkSync(outPath); } catch (_) {}
      }
    }
  });

  res.json({
    message: 'Remuxing started',
    jobId: id,
    status: 'processing'
  });
});

// SSE endpoint for live remux progress
app.get('/api/remux-progress/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(() => {
    const currentJob = activeJobs.get(id);
    if (!currentJob) {
      clearInterval(interval);
      res.end();
      return;
    }

    const data = JSON.stringify({
      status: currentJob.status,
      progressPercent: currentJob.progressPercent,
      speed: currentJob.speed,
      fps: currentJob.fps,
      frame: currentJob.frame,
      bitrate: currentJob.bitrate,
      error: currentJob.error,
      comparison: currentJob.comparison,
      outputMetadata: currentJob.outputMetadata
    });

    res.write(`data: ${data}\n\n`);

    if (currentJob.status === 'completed' || currentJob.status === 'failed') {
      clearInterval(interval);
      res.end();
    }
  }, 150);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Get job status / comparison
app.get('/api/job/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId: id,
    status: job.status,
    progressPercent: job.progressPercent,
    speed: job.speed,
    fps: job.fps,
    frame: job.frame,
    bitrate: job.bitrate,
    error: job.error,
    inputMetadata: job.inputMetadata,
    outputMetadata: job.outputMetadata,
    comparison: job.comparison,
    outputFilename: job.outputFilename
  });
});

// Stream video (with Range requests for HTML5 video playback)
app.get('/api/video/:id/:type', (req: Request, res: Response) => {
  const { id, type } = req.params;
  const job = activeJobs.get(id);

  if (!job) {
    return res.status(404).send('Session not found');
  }

  const filePath = type === 'output' ? job.outputPath : job.inputPath;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = path.extname(filePath).toLowerCase() === '.mov' ? 'video/quicktime' : 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Download processed file (verifies integrity before allowing download)
app.get('/api/download/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: 'Processed video not found or job not finished.' });
  }

  // Pre-download Verification Gate: block corrupted or unverified output
  if (job.comparison?.verification && !job.comparison.verification.canDownload) {
    return res.status(403).json({
      error: 'Download blocked: Processed file failed stream integrity verification checks.',
      verification: job.comparison.verification
    });
  }

  const downloadFilename = job.outputFilename || 'clearframe_remuxed.mp4';
  res.download(job.outputPath, downloadFilename);
});

// Delete / Cleanup Session
app.delete('/api/session/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (job) {
    if (job.inputPath && fs.existsSync(job.inputPath)) {
      try { fs.unlinkSync(job.inputPath); } catch (e) {}
    }
    if (job.outputPath && fs.existsSync(job.outputPath)) {
      try { fs.unlinkSync(job.outputPath); } catch (e) {}
    }
    activeJobs.delete(id);
  }

  res.json({ message: 'Session files successfully deleted.' });
});

// Sample clips endpoint: generates and returns 4 test videos (4K UHD, 9:16 vertical MP4, MOV, incompatible)
app.post('/api/samples/generate', async (_req: Request, res: Response) => {
  const sample1 = path.join(SAMPLES_DIR, 'clearframe_sample_social_vertical.mp4');
  const sample2 = path.join(SAMPLES_DIR, 'clearframe_sample_quicktime.mov');
  const sample3 = path.join(SAMPLES_DIR, 'clearframe_sample_incompatible_prores.mov');
  const sample4 = path.join(SAMPLES_DIR, 'clearframe_sample_4k_landscape.mp4');

  const generateClip = (args: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      execFile(FFMPEG_BIN, args, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  };

  try {
    // 1. Vertical 1080x1920 60fps H.264 + AAC 4-second clip
    if (!fs.existsSync(sample1)) {
      await generateClip([
        '-y',
        '-f', 'lavfi', '-i', 'testsrc=duration=4:size=1080x1920:rate=60',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        sample1
      ]);
    }

    // 2. QuickTime MOV with H.264 + AAC
    if (!fs.existsSync(sample2)) {
      await generateClip([
        '-y',
        '-f', 'lavfi', '-i', 'smptebars=duration=3:size=1920x1080:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=880:duration=3',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        sample2
      ]);
    }

    // 3. Incompatible sample: ProRes video + raw PCM audio (cannot be stream-copied to MP4 without re-encode)
    if (!fs.existsSync(sample3)) {
      await generateClip([
        '-y',
        '-f', 'lavfi', '-i', 'testsrc=duration=2:size=1280x720:rate=24',
        '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2',
        '-c:v', 'prores_ks', '-profile:v', '0',
        '-c:a', 'pcm_s16le',
        sample3
      ]);
    }

    // 4. 4K UHD Master (3840x2160 @ 60fps) H.264 + AAC 2-second clip
    if (!fs.existsSync(sample4)) {
      await generateClip([
        '-y',
        '-f', 'lavfi', '-i', 'testsrc=duration=2:size=3840x2160:rate=60',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        sample4
      ]);
    }

    res.json({
      samples: [
        {
          id: 'sample_4k_landscape',
          title: '4K UHD Cinema Master (3840×2160 @ 60fps)',
          description: 'Original quality 4K UHD 60fps file. Verifies zero downscaling and 100% resolution preservation.',
          path: sample4,
          type: 'compatible'
        },
        {
          id: 'sample_social_vertical',
          title: '9:16 Vertical Reel (H.264/AAC MP4)',
          description: '1080x1920 @ 60fps vertical video, ideal for TikTok/Reels lossless remux testing',
          path: sample1,
          type: 'compatible'
        },
        {
          id: 'sample_quicktime',
          title: 'QuickTime Studio Clip (H.264 MOV)',
          description: '1920x1080 MOV container, ready to be remuxed losslessly to MP4 with FastStart',
          path: sample2,
          type: 'compatible'
        },
        {
          id: 'sample_incompatible',
          title: 'Incompatible ProRes + PCM Master (MOV)',
          description: 'ProRes video + PCM audio. Demonstrates ClearFrame rejection of silent lossy re-encoding',
          path: sample3,
          type: 'incompatible'
        }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to generate sample clips: ${err.message}` });
  }
});

// Load sample as active session
app.post('/api/samples/load/:sampleId', async (req: Request, res: Response) => {
  const { sampleId } = req.params;
  const sampleMap: Record<string, { filename: string; path: string }> = {
    sample_4k_landscape: {
      filename: 'sample_4k_uhd_3840x2160_60fps.mp4',
      path: path.join(SAMPLES_DIR, 'clearframe_sample_4k_landscape.mp4')
    },
    sample_social_vertical: {
      filename: 'sample_social_1080x1920_60fps.mp4',
      path: path.join(SAMPLES_DIR, 'clearframe_sample_social_vertical.mp4')
    },
    sample_quicktime: {
      filename: 'sample_master_1080p.mov',
      path: path.join(SAMPLES_DIR, 'clearframe_sample_quicktime.mov')
    },
    sample_incompatible: {
      filename: 'sample_prores_master.mov',
      path: path.join(SAMPLES_DIR, 'clearframe_sample_incompatible_prores.mov')
    }
  };

  const selected = sampleMap[sampleId];
  if (!selected) {
    return res.status(404).json({ error: 'Sample not found' });
  }

  // Ensure file exists or trigger generation
  if (!fs.existsSync(selected.path)) {
    return res.status(400).json({ error: 'Sample not yet generated. Please call /api/samples/generate first.' });
  }

  // Copy sample to unique uploads file
  const jobId = crypto.randomUUID();
  const ext = path.extname(selected.path);
  const destPath = path.join(UPLOADS_DIR, `${jobId}${ext}`);
  fs.copyFileSync(selected.path, destPath);

  try {
    const metadata = await probeVideoFile(destPath, selected.filename);
    const compatibility = checkRemuxCompatibility(metadata, 'mp4');

    const job: RemuxJob = {
      id: jobId,
      status: 'pending',
      progressPercent: 0,
      speed: '0x',
      fps: 0,
      frame: 0,
      bitrate: 'N/A',
      inputPath: destPath,
      inputMetadata: metadata,
      filename: selected.filename,
      createdAt: Date.now()
    };

    activeJobs.set(jobId, job);

    res.json({
      jobId,
      filename: selected.filename,
      metadata,
      compatibility
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Automated background cleanup interval (every 10 mins: delete files older than 30 mins)
setInterval(() => {
  const now = Date.now();
  const MAX_AGE_MS = 30 * 60 * 1000;

  for (const dir of [UPLOADS_DIR, PROCESSED_DIR]) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      console.error('Error during cleanup interval:', e);
    }
  }

  // Clean memory activeJobs
  for (const [id, job] of activeJobs.entries()) {
    if (now - job.createdAt > MAX_AGE_MS) {
      activeJobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'An internal server error occurred.'
  });
});

// Vite middleware mounting in dev mode
async function startServer() {
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[ClearFrame] Full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
