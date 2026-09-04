import { useState } from 'react';
import { ChevronDown, ChevronUp, Satellite } from 'lucide-react';

interface ImageMetadataPanelProps {
  modeCategory?: string;
}

export function ImageMetadataPanel({ modeCategory: _modeCategory = 'compare' }: ImageMetadataPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const metadataItems = [
    { label: 'Sensor', value: 'Sentinel-2 MSI / Landsat 9', isTechnical: false },
    { label: 'Acquisition Date', value: '2026-03-12 (T1) & 2025-03-12 (T0)', isTechnical: false },
    { label: 'Resolution', value: '10m Ground Sample Distance', isTechnical: false },
    { label: 'CRS', value: 'EPSG:4326 · WGS 84', isTechnical: true },
    { label: 'Coordinates', value: '28.6139° N, 77.2090° E', isTechnical: true },
    { label: 'Dimensions', value: '2048 × 2048 px', isTechnical: true },
    { label: 'Bands', value: 'B02 (Blue), B03 (Green), B04 (Red), B08 (NIR)', isTechnical: true },
  ];

  return (
    <div className="relative rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm overflow-hidden">
      {/* Background Subtle Watermark Satellite Icon */}
      <div className="absolute -bottom-4 -right-4 text-slate-100 dark:text-slate-800/40 pointer-events-none select-none">
        <Satellite className="w-24 h-24 stroke-[1]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">
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
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 mt-2">
            {metadataItems.map((item, idx) => (
              <>
                <span
                  key={`label-${idx}`}
                  className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap leading-relaxed"
                >
                  {item.label}
                </span>
                <span
                  key={`value-${idx}`}
                  className={`text-[11px] text-slate-800 dark:text-slate-200 min-w-0 leading-relaxed ${
                    item.isTechnical ? 'font-mono font-medium' : ''
                  }`}
                >
                  {item.value}
                </span>
              </>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

