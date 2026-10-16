import { useState } from 'react';
import { X, Terminal, Server, Shield, Check, Copy } from 'lucide-react';

interface SetupInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupInstructionsModal: React.FC<SetupInstructionsModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeBlocks = [
    {
      title: '1. Linux / Ubuntu / Debian Host Setup',
      command: 'sudo apt update && sudo apt install -y ffmpeg'
    },
    {
      title: '2. macOS Host Setup (Homebrew)',
      command: 'brew install ffmpeg'
    },
    {
      title: '3. Node.js Dependency Installation & Launch',
      command: 'npm install\nnpm run dev'
    },
    {
      title: '4. Production Build & Server Start',
      command: 'npm run build\nnpm start'
    },
    {
      title: '5. Dockerfile Snippet for Cloud Run / Container Deployment',
      command: `FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]`
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Setup, Dependencies & Deployment
              </h3>
              <p className="text-xs text-slate-400">
                Instructions for local development, Linux host dependencies, and production deployment
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

        {/* Content */}
        <div className="space-y-4 text-xs text-slate-300">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/30 border border-blue-900/50 text-blue-200">
            <Server className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              ClearFrame relies on system-level <strong>FFmpeg</strong> and <strong>FFprobe</strong> binaries available in your system PATH (or configured via <code className="font-mono text-blue-300">FFMPEG_PATH</code> / <code className="font-mono text-blue-300">FFPROBE_PATH</code>).
            </span>
          </div>

          <div className="space-y-3">
            {codeBlocks.map((block, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs">{block.title}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(block.command, idx)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto whitespace-pre">
                  {block.command}
                </pre>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span>Production Security & File Hygiene Policy</span>
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
              <li>Never runs shell command strings (<code className="font-mono text-slate-300">exec</code> is banned); uses argument arrays (<code className="font-mono text-slate-300">spawn</code> and <code className="font-mono text-slate-300">execFile</code>).</li>
              <li>Uploads are limited to 300 MB per file and stored with UUID keys to eliminate path traversal vulnerabilities.</li>
              <li>Background cron garbage collector deletes temporary files older than 30 minutes.</li>
              <li>Supports immediate session file purge upon download or by clicking "Clear Session".</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
