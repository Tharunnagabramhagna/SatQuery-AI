import { useState } from 'react';
import { ChevronDown, ChevronUp, Satellite } from 'lucide-react';

interface ImageMetadataPanelProps {
  modeCategory?: string;
}

export function ImageMetadataPanel({ modeCategory: _modeCategory = 'compare' }: ImageMetadataPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const metadataItems = [
    { label: 'Sensor', value: 'Sentinel-2 MSI / Landsat 9' },
    { label: 'Acquisition Date', value: '2026-03-12 (T1) & 2025-03-12 (T0)' },
    { label: 'Resolution', value: '10m Ground Sample Distance' },
    { label: 'CRS', value: 'EPSG:4326 - WGS 84' },
    { label: 'Coordinates', value: '28.6139° N, 77.2090° E' },
    { label: 'Dimensions', value: '2048 × 2048 px' },
    { label: 'Bands', value: 'B02 (Blue), B03 (Green), B04 (Red), B08 (NIR)' },
  ];

  return (
    <div className="relative rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm overflow-hidden">
      {/* Background Subtle Watermark Satellite Icon */}
      <div className="absolute -bottom-4 -right-4 text-slate-100 dark:text-slate-800/40 pointer-events-none select-none">
        <Satellite className="w-24 h-24 stroke-[1]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wide">
            Image Metadata Panel
          </h2>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-1.5 mt-2 text-xs">
            {metadataItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className="text-[11px] font-mono text-slate-800 dark:text-slate-200 text-right truncate max-w-[180px]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
