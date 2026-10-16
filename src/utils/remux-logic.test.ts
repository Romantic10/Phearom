import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRemuxCompatibility,
  parseFfmpegProgressLine,
  parseTimestampToSeconds,
  compareMetadata,
  formatFps,
  formatBytes,
  formatDuration,
  formatBitrate,
  getResolutionTier,
  verifyProcessedOutput,
  type ProbeMetadata
} from './remux-logic.ts';

test('compatibility check accepts standard H.264 / AAC in MP4 container', () => {
  const metadata: ProbeMetadata = {
    filename: 'clip.mp4',
    format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
    size: 15000000,
    duration: 12.5,
    bit_rate: 9600000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      avg_frame_rate: '60/1',
      pix_fmt: 'yuv420p'
    },
    audioStream: {
      index: 1,
      codec_name: 'aac',
      sample_rate: '48000',
      channels: 2
    }
  };

  const report = checkRemuxCompatibility(metadata, 'mp4');
  assert.equal(report.isCompatible, true);
  assert.equal(report.videoCompatible, true);
  assert.equal(report.audioCompatible, true);
  assert.equal(report.reasons.length, 0);
});

test('compatibility check flags incompatible ProRes video in MP4 container', () => {
  const metadata: ProbeMetadata = {
    filename: 'raw_capture.mov',
    format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
    size: 250000000,
    duration: 8.0,
    bit_rate: 250000000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'prores',
      width: 3840,
      height: 2160
    },
    audioStream: {
      index: 1,
      codec_name: 'pcm_s24le'
    }
  };

  const report = checkRemuxCompatibility(metadata, 'mp4');
  assert.equal(report.isCompatible, false);
  assert.equal(report.videoCompatible, false);
  assert.equal(report.audioCompatible, false);
  assert.match(report.reasons[0], /Video codec "prores" cannot be stream-copied/);
});

test('FFmpeg progress parser calculates percentage and metrics correctly', () => {
  const progressText = `frame=180
fps=90.5
stream_0_0_q=-1.0
bitrate=8500.2kbits/s
total_size=5242880
out_time_us=6000000
out_time_ms=6000000
out_time=00:00:06.000000
dup_frames=0
drop_frames=0
speed=3.02x
progress=continue`;

  const parsed = parseFfmpegProgressLine(progressText, 12.0);
  assert.equal(parsed.progressPercent, 50);
  assert.equal(parsed.outTimeSeconds, 6.0);
  assert.equal(parsed.speed, '3.02x');
  assert.equal(parsed.frame, 180);
});

test('compareMetadata identifies bit-for-bit preservation and zero generation loss', () => {
  const input: ProbeMetadata = {
    filename: 'input.mov',
    format_name: 'mov',
    size: 10000000,
    duration: 10.0,
    bit_rate: 8000000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'h264',
      width: 1080,
      height: 1920,
      avg_frame_rate: '30/1',
      pix_fmt: 'yuv420p'
    },
    audioStream: {
      index: 1,
      codec_name: 'aac',
      sample_rate: '44100'
    },
    hasFastStart: false
  };

  const output: ProbeMetadata = {
    filename: 'output.mp4',
    format_name: 'mp4',
    size: 9985000,
    duration: 10.0,
    bit_rate: 7988000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'h264',
      width: 1080,
      height: 1920,
      avg_frame_rate: '30/1',
      pix_fmt: 'yuv420p'
    },
    audioStream: {
      index: 1,
      codec_name: 'aac',
      sample_rate: '44100'
    },
    hasFastStart: true
  };

  const comparison = compareMetadata(input, output);
  assert.equal(comparison.isLossless, true);
  assert.equal(comparison.fastStartEnabled, true);
  assert.match(comparison.generationLoss, /0.00%/);
  const vCodecItem = comparison.items.find(i => i.property === 'video_codec');
  assert.equal(vCodecItem?.preserved, true);
});

test('formatting utilities work with various edge cases', () => {
  assert.equal(formatFps('30000/1001'), '29.97');
  assert.equal(formatFps('60/1'), '60.00');
  assert.equal(formatDuration(65.5), '01:05.5');
  assert.equal(formatDuration(3661), '01:01:01');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBitrate(15000000), '15.00 Mbps');
  assert.equal(formatBitrate(320000), '320 kbps');
  assert.equal(parseTimestampToSeconds('00:01:30.500'), 90.5);
});

test('resolution tier correctly identifies 4K UHD, 2K QHD, 1080p, 720p', () => {
  assert.equal(getResolutionTier(3840, 2160), '4K UHD (2160p)');
  assert.equal(getResolutionTier(2160, 3840), '4K UHD (2160p)'); // Vertical 4K
  assert.equal(getResolutionTier(2560, 1440), '2K QHD (1440p)');
  assert.equal(getResolutionTier(1920, 1080), '1080p Full HD');
  assert.equal(getResolutionTier(1080, 1920), '1080p Full HD'); // Vertical 1080p
  assert.equal(getResolutionTier(1280, 720), '720p HD');
  assert.equal(getResolutionTier(640, 480), '640×480 SD');
});

test('verifyProcessedOutput succeeds on 4K UHD file with zero downscaling', () => {
  const input4K: ProbeMetadata = {
    filename: 'cinema_master_4k.mp4',
    format_name: 'mov,mp4',
    size: 50000000,
    duration: 5.0,
    bit_rate: 80000000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'h264',
      width: 3840,
      height: 2160,
      avg_frame_rate: '60/1',
      pix_fmt: 'yuv420p'
    },
    audioStream: {
      index: 1,
      codec_name: 'aac',
      sample_rate: '48000'
    },
    hasFastStart: false
  };

  const output4K: ProbeMetadata = {
    filename: 'clearframe_cinema_master_4k.mp4',
    format_name: 'mp4',
    size: 49990000,
    duration: 5.0,
    bit_rate: 79980000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'h264',
      width: 3840,
      height: 2160,
      avg_frame_rate: '60/1',
      pix_fmt: 'yuv420p'
    },
    audioStream: {
      index: 1,
      codec_name: 'aac',
      sample_rate: '48000'
    },
    hasFastStart: true
  };

  const verification = verifyProcessedOutput(input4K, output4K);
  assert.equal(verification.isVerified, true);
  assert.equal(verification.canDownload, true);
  assert.equal(verification.checks.length, 7);
  assert.ok(verification.checks.every(c => c.passed));
});

test('verifyProcessedOutput detects downscaling failure and blocks download', () => {
  const input4K: ProbeMetadata = {
    filename: 'original_4k.mov',
    format_name: 'mov',
    size: 60000000,
    duration: 4.0,
    bit_rate: 120000000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'h264',
      width: 3840,
      height: 2160,
      avg_frame_rate: '60/1',
      pix_fmt: 'yuv420p'
    },
    audioStream: {
      index: 1,
      codec_name: 'aac',
      sample_rate: '48000'
    }
  };

  // Simulating an unauthorized downscaled output (downscaled to 1080p)
  const badOutput: ProbeMetadata = {
    filename: 'downscaled.mp4',
    format_name: 'mp4',
    size: 15000000,
    duration: 4.0,
    bit_rate: 30000000,
    streams: [],
    videoStream: {
      index: 0,
      codec_name: 'h264',
      width: 1920,
      height: 1080, // DOWNSCALED!
      avg_frame_rate: '60/1',
      pix_fmt: 'yuv420p'
    },
    audioStream: {
      index: 1,
      codec_name: 'aac',
      sample_rate: '48000'
    },
    hasFastStart: true
  };

  const verification = verifyProcessedOutput(input4K, badOutput);
  assert.equal(verification.isVerified, false);
  assert.equal(verification.canDownload, false); // Download must be blocked!
  const resCheck = verification.checks.find(c => c.name.includes('Resolution'));
  assert.equal(resCheck?.passed, false);
});
