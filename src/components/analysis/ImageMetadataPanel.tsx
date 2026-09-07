import { Info, Satellite, MapPin, Layers, Calendar, Maximize2 } from 'lucide-react';
import type { ImageMetadata } from '../../types';
import { Badge } from '../common/Badge';

interface ImageMetadataPanelProps {
  metadata: ImageMetadata | null;
  className?: string;
}

export function ImageMetadataPanel({ metadata, className }: ImageMetadataPanelProps) {
  if (!metadata) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`mt-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs transition-colors ${className}`}>
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300 font-semibold">
          <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Image Metadata</span>
        </div>
        {metadata.isDemo && (
          <Badge variant="demo" className="text-[9px]">DEMO METADATA</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
        <div>
          <span className="text-slate-500 block">Format:</span>
          <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">{metadata.format}</span>
        </div>
        <div>
          <span className="text-slate-500 block">File Size:</span>
          <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">{formatFileSize(metadata.fileSize)}</span>
        </div>
        {metadata.dimensions && (
          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-500 block">Dimensions:</span>
              <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">
                {metadata.dimensions.width} × {metadata.dimensions.height} px
              </span>
            </div>
          </div>
        )}
        {metadata.sensor && (
          <div className="flex items-center gap-1.5">
            <Satellite className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-500 block">Sensor:</span>
              <span className="text-slate-800 dark:text-slate-300 font-medium">{metadata.sensor}</span>
            </div>
          </div>
        )}
        {metadata.resolution && (
          <div>
            <span className="text-slate-500 block">Ground Resolution:</span>
            <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">{metadata.resolution}</span>
          </div>
        )}
        {metadata.crs && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-500 block">CRS:</span>
              <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">{metadata.crs}</span>
            </div>
          </div>
        )}
        {metadata.bands && (
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-500 block">Spectral Bands:</span>
              <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">{metadata.bands} Bands</span>
            </div>
          </div>
        )}
        {metadata.acquisitionDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-500 block">Acquisition:</span>
              <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">
                {new Date(metadata.acquisitionDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {metadata.bounds && (
        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="text-slate-500 font-medium mr-1">Geographic Bounds:</span>
          <span className="font-mono text-slate-800 dark:text-slate-300">{metadata.bounds}</span>
        </div>
      )}
    </div>
  );
}
