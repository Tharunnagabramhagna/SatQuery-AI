import { useState } from 'react';
import { ChevronDown, ChevronUp, Satellite, Layers, Calendar, Sliders } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ImageMetadataPanelProps {
  modeCategory?: 'single' | 'compare' | 'fusion' | string;
}

export function ImageMetadataPanel({ modeCategory = 'compare' }: ImageMetadataPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Base image parameters
  const baseItems = [
    { label: 'Platform', value: modeCategory === 'fusion' ? 'Sentinel-2 MSI + Sentinel-1 SAR' : 'Sentinel-2 MSI', isMono: false },
    { label: 'Resolution', value: '10m Ground Sample Distance', isMono: false },
    { label: 'CRS', value: 'EPSG:4326 · WGS 84', isMono: true },
    { label: 'Coordinates', value: '28.6139° N, 77.2090° E', isMono: true },
    { label: 'Dimensions', value: '2048 × 2048 px', isMono: true },
  ];

  return (
    <div className="relative rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm overflow-hidden">
      {/* Background Subtle Watermark Satellite Icon */}
      <div className="absolute -bottom-4 -right-4 text-slate-100 dark:text-slate-800/30 pointer-events-none select-none">
        <Satellite className="w-24 h-24 stroke-[1]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              Image Metadata Panel
            </h2>
            <span className="px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {modeCategory}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded focus:outline-none"
            aria-label={isExpanded ? 'Collapse metadata panel' : 'Expand metadata panel'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-3 mt-2">
            {/* Section 1: Platform & Spatial Metadata */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                <Satellite className="w-3 h-3 text-cyan-500" /> Platform & Spatial
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 pl-1">
                {baseItems.map((item, idx) => (
                  <div key={idx} className="contents">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] text-slate-800 dark:text-slate-200 min-w-0 leading-relaxed truncate',
                        item.isMono && 'font-mono'
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Mode-Specific Group */}
            {modeCategory === 'compare' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Temporal Comparison
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 pl-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    Baseline (T0)
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 font-mono leading-relaxed">
                    2025-03-12 (Sentinel-2 MSI)
                  </span>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    Observation (T1)
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 font-mono leading-relaxed">
                    2026-03-12 (Sentinel-2 MSI)
                  </span>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    Temporal Delta
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed">
                    365 days (1 Year)
                  </span>
                </div>
              </div>
            )}

            {modeCategory === 'fusion' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500 dark:text-cyan-400 mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Optical + SAR Fusion
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 pl-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    Optical Channel
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed">
                    Sentinel-2 Visible (B04, B03, B02)
                  </span>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    SAR Channel
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed">
                    C-Band Radar Backscatter (Simulated)
                  </span>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    Polarization
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 font-mono leading-relaxed">
                    VV / VH Cross-Polarization
                  </span>
                </div>
              </div>
            )}

            {modeCategory === 'single' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                  <Sliders className="w-3 h-3" /> Spectral Configuration
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 pl-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    Active Bands
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 font-mono leading-relaxed">
                    B02 (Blue), B03 (Green), B04 (Red), B08 (NIR)
                  </span>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed">
                    Acquisition Date
                  </span>
                  <span className="text-[11px] text-slate-800 dark:text-slate-200 font-mono leading-relaxed">
                    2026-03-12
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
