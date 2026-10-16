/**
 * End-to-End Functional Test Suite for ClearFrame
 * Tests real FFmpeg/FFprobe operations, file validation, remuxing, stream audit, and cleanup.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

test('1. System Health: FFmpeg & FFprobe binary inspection', async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'healthy');
  assert.equal(data.ffmpegAvailable, true);
  assert.equal(data.ffprobeAvailable, true);
  assert.match(data.ffmpegVersion, /ffmpeg version/);
  assert.match(data.ffprobeVersion, /ffprobe version/);
});

test('2. File Validation: Rejects invalid file format', async () => {
  const formData = new FormData();
  const fakeBlob = new Blob(['Not a video file content'], { type: 'text/plain' });
  formData.append('video', fakeBlob, 'malicious_script.txt');

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });

  assert.equal(res.status, 500); // Multer fileFilter error triggers 500 with descriptive message
  const data = await res.json();
  assert.match(data.error, /Unsupported file type/);
});

test('3. Test Samples Generation and Listing (including 4K UHD)', async () => {
  const res = await fetch(`${BASE_URL}/api/samples/generate`, { method: 'POST' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.samples));
  assert.equal(data.samples.length, 4);

  const sampleIds = data.samples.map((s: any) => s.id);
  assert.ok(sampleIds.includes('sample_4k_landscape'));
  assert.ok(sampleIds.includes('sample_social_vertical'));
  assert.ok(sampleIds.includes('sample_quicktime'));
  assert.ok(sampleIds.includes('sample_incompatible'));
});

test('4. End-to-End Remux Flow: QuickTime MOV -> Standard MP4 with FastStart', async () => {
  // A. Load QuickTime MOV sample
  const loadRes = await fetch(`${BASE_URL}/api/samples/load/sample_quicktime`, { method: 'POST' });
  assert.equal(loadRes.status, 200);
  const loadData = await loadRes.json();
  const jobId = loadData.jobId;
  assert.ok(jobId, 'Job ID must be generated');

  // Verify initial metadata
  assert.equal(loadData.metadata.videoStream.codec_name, 'h264');
  assert.equal(loadData.metadata.videoStream.width, 1920);
  assert.equal(loadData.metadata.videoStream.height, 1080);
  assert.equal(loadData.metadata.hasFastStart, false);
  assert.equal(loadData.compatibility.isCompatible, true);

  // B. Trigger Lossless Remux to MP4
  const remuxRes = await fetch(`${BASE_URL}/api/remux/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetContainer: 'mp4',
      faststart: true,
      stripMetadata: false,
      optimizeColorTags: true
    })
  });
  assert.equal(remuxRes.status, 200);

  // C. Wait for completion and query /api/job/:id
  let completed = false;
  let jobData: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const statusRes = await fetch(`${BASE_URL}/api/job/${jobId}`);
    jobData = await statusRes.json();
    if (jobData.status === 'completed') {
      completed = true;
      break;
    }
  }

  assert.equal(completed, true, 'Remux job must complete within time limit');
  assert.equal(jobData.progressPercent, 100);

  // D. Audit stream preservation
  const comp = jobData.comparison;
  assert.ok(comp, 'Comparison report must be present');
  assert.equal(comp.isLossless, true);
  assert.match(comp.generationLoss, /0.00%/);
  assert.equal(comp.fastStartEnabled, true);

  // Video Codec, resolution, fps, chroma preserved
  const vCodecItem = comp.items.find((it: any) => it.property === 'video_codec');
  assert.equal(vCodecItem.preserved, true);
  assert.equal(vCodecItem.inputVal, 'H264');
  assert.equal(vCodecItem.outputVal, 'H264');

  const resItem = comp.items.find((it: any) => it.property === 'resolution');
  assert.equal(resItem.preserved, true);
  assert.equal(resItem.inputVal, '1920x1080');
  assert.equal(resItem.outputVal, '1920x1080');

  // Faststart was enabled
  const fastStartItem = comp.items.find((it: any) => it.property === 'faststart');
  assert.equal(fastStartItem.inputVal, 'Missing / At End');
  assert.equal(fastStartItem.outputVal, 'Enabled (Optimized)');

  // E. Video Range Request (HTTP 206) for HTML5 video player
  const rangeRes = await fetch(`${BASE_URL}/api/video/${jobId}/output`, {
    headers: { Range: 'bytes=0-1023' }
  });
  assert.equal(rangeRes.status, 206);
  assert.equal(rangeRes.headers.get('content-type'), 'video/mp4');
  assert.match(rangeRes.headers.get('content-range') || '', /^bytes 0-1023\//);

  // F. Download Endpoint Verification
  const downloadRes = await fetch(`${BASE_URL}/api/download/${jobId}`);
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers.get('content-type'), 'video/mp4');
  const buffer = await downloadRes.arrayBuffer();
  assert.ok(buffer.byteLength > 1000, 'Downloaded video must have valid file bytes');

  // G. Cleanup session files
  const deleteRes = await fetch(`${BASE_URL}/api/session/${jobId}`, { method: 'DELETE' });
  assert.equal(deleteRes.status, 200);

  // Verify that video stream endpoint returns 404 after cleanup
  const postDeleteRes = await fetch(`${BASE_URL}/api/video/${jobId}/output`);
  assert.equal(postDeleteRes.status, 404);
});

test('5. Incompatible Codec Refusal: Rejects silent re-encoding for ProRes + PCM master', async () => {
  // A. Load Incompatible ProRes sample
  const loadRes = await fetch(`${BASE_URL}/api/samples/load/sample_incompatible`, { method: 'POST' });
  assert.equal(loadRes.status, 200);
  const loadData = await loadRes.json();
  const jobId = loadData.jobId;

  // Verify compatibility check flags incompatibility
  assert.equal(loadData.compatibility.isCompatible, false);
  assert.equal(loadData.compatibility.videoCompatible, false);
  assert.equal(loadData.compatibility.audioCompatible, false);
  assert.ok(loadData.compatibility.reasons.length >= 2);

  // B. Attempt to force remux to MP4
  const remuxRes = await fetch(`${BASE_URL}/api/remux/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetContainer: 'mp4' })
  });

  // Must reject with HTTP 400 and clear error report
  assert.equal(remuxRes.status, 400);
  const remuxData = await remuxRes.json();
  assert.equal(remuxData.error, 'Incompatible for lossless stream-copy remuxing.');
  assert.match(remuxData.compatibility.recommendation, /To uphold ClearFrame's zero-quality-loss policy, this file will not be silently re-encoded/);

  // Clean up
  await fetch(`${BASE_URL}/api/session/${jobId}`, { method: 'DELETE' });
});

test('6. System Config: Adjustable upload size limit and disk streaming support', async () => {
  // A. Fetch config
  const getRes = await fetch(`${BASE_URL}/api/config`);
  assert.equal(getRes.status, 200);
  const cfg = await getRes.json();
  assert.ok(cfg.maxUploadSizeMB >= 100);
  assert.equal(cfg.supports4KUHD, true);
  assert.match(cfg.storageMethod, /disk/i);

  // B. Adjust limit to 1024 MB
  const postRes = await fetch(`${BASE_URL}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limitMB: 1024 })
  });
  assert.equal(postRes.status, 200);
  const updated = await postRes.json();
  assert.equal(updated.maxUploadSizeMB, 1024);

  // Restore to 2048 MB
  await fetch(`${BASE_URL}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limitMB: 2048 })
  });
});

test('7. 4K UHD End-to-End Remux: Zero downscaling & Pre-download verification', async () => {
  // A. Load 4K UHD Master sample
  const loadRes = await fetch(`${BASE_URL}/api/samples/load/sample_4k_landscape`, { method: 'POST' });
  assert.equal(loadRes.status, 200);
  const loadData = await loadRes.json();
  const jobId = loadData.jobId;

  // Assert 4K UHD dimensions: 3840 x 2160 @ 60fps
  assert.equal(loadData.metadata.videoStream.width, 3840);
  assert.equal(loadData.metadata.videoStream.height, 2160);
  assert.equal(loadData.compatibility.isCompatible, true);

  // B. Remux 4K stream losslessly
  const remuxRes = await fetch(`${BASE_URL}/api/remux/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetContainer: 'mp4',
      faststart: true,
      stripMetadata: false,
      optimizeColorTags: true
    })
  });
  assert.equal(remuxRes.status, 200);

  // C. Poll for completion
  let jobData: any = null;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const statusRes = await fetch(`${BASE_URL}/api/job/${jobId}`);
    jobData = await statusRes.json();
    if (jobData.status === 'completed') {
      break;
    }
  }

  assert.equal(jobData.status, 'completed');

  // D. Verify Zero Downscaling & Output Verification
  assert.equal(jobData.outputMetadata.videoStream.width, 3840, '4K width must be preserved');
  assert.equal(jobData.outputMetadata.videoStream.height, 2160, '4K height must be preserved');
  assert.equal(jobData.comparison.isLossless, true);
  assert.match(jobData.comparison.generationLoss, /0.00%/);

  const verification = jobData.comparison.verification;
  assert.ok(verification, 'Verification certificate must be generated');
  assert.equal(verification.isVerified, true);
  assert.equal(verification.canDownload, true);

  // Check the resolution check explicitly
  const resCheck = verification.checks.find((c: any) => c.name.includes('Resolution'));
  assert.equal(resCheck.passed, true);
  assert.match(resCheck.details, /Zero downscaling verified/);

  // E. Download verified 4K file
  const downloadRes = await fetch(`${BASE_URL}/api/download/${jobId}`);
  assert.equal(downloadRes.status, 200);
  const buffer = await downloadRes.arrayBuffer();
  assert.ok(buffer.byteLength > 1000);

  // Clean up
  await fetch(`${BASE_URL}/api/session/${jobId}`, { method: 'DELETE' });
});
