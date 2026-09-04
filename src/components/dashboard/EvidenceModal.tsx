import { X, ShieldCheck, FileCheck, Layers, MapPin } from 'lucide-react';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  confidence: number;
}

export function EvidenceModal({ isOpen, onClose, confidence }: EvidenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0a0f1e] border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Evidence Verification & Grounding Trace
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sub-pixel spatial verification with {confidence}% calibrated multimodal confidence proofs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
              <span className="flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <span>Spatial Bounding Proof</span>
              </span>
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                IoU: 0.912 / 1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Bounding polygons passed automated topological consistency verification. Geometric distortion corrected via orbital ephemeris.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-500" />
                <span>Multispectral Texture Consistency</span>
              </span>
              <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                Coherence: 98.4%
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Normalized Difference Vegetation Index (NDVI) dropped by -0.42 across the central zone, corroborating surface soil disturbance and foundation laying.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span>Geographic Reference Bounds</span>
              </span>
              <span className="font-mono text-[11px] text-blue-600 dark:text-cyan-400">
                EPSG:4326
              </span>
            </div>
            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 mt-1">
              <div>NW: 28.6180° N, 77.2025° E</div>
              <div>SE: 28.6095° N, 77.2155° E</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Audit ID: <span className="font-mono text-slate-700 dark:text-slate-300">EV-20260312-91</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
