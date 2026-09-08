import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileImage,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  Loader2,
} from 'lucide-react';
import type { UploadedImage } from '../../types';
import { ImageMetadataPanel } from './ImageMetadataPanel';
import { cn } from '../../utils/cn';

interface ImageUploadProps {
  label: string;
  sublabel?: string;
  modalityBadge?: string;
  image: UploadedImage | null | undefined;
  onUpload: (file: File) => void;
  onRemove: () => void;
  error?: string;
  disabled?: boolean;
}

export function ImageUpload({
  label,
  sublabel = 'Supports GeoTIFF, TIFF, PNG, JPEG up to 100MB',
  modalityBadge,
  image,
  onUpload,
  onRemove,
  error,
  disabled = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrlInput.trim() || disabled) return;

    try {
      setIsFetchingUrl(true);
      setUrlError(null);
      const res = await fetch(imageUrlInput.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const filename = imageUrlInput.split('/').pop()?.split('?')[0] || 'remote_image.png';
      const file = new File([blob], filename, { type: blob.type || 'image/png' });
      onUpload(file);
      setImageUrlInput('');
    } catch (err: any) {
      setUrlError(`Could not load image from URL: ${err.message || 'Network error'}`);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files[0]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col w-full">
      {/* Label and Modality Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</span>
          {modalityBadge && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
              {modalityBadge}
            </span>
          )}
        </div>
        {image?.status === 'uploaded' && image.metadata ? (
          <button
            type="button"
            onClick={() => setShowMetadata((prev) => !prev)}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{showMetadata ? 'Hide Metadata' : 'View Metadata'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors',
                activeTab === 'file'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors',
                activeTab === 'url'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              URL
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".tiff,.tif,.geotiff,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Upload Box States */}
      {!image || image.status === 'idle' ? (
        activeTab === 'url' ? (
          <form
            onSubmit={handleUrlSubmit}
            className="flex flex-col p-5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/40 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Link2 className="w-4 h-4 text-cyan-500" />
              <span>Enter Remote Satellite Image URL (HTTP/HTTPS)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://example.com/sentinel_scene.png"
                disabled={isFetchingUrl || disabled}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="submit"
                disabled={!imageUrlInput.trim() || isFetchingUrl || disabled}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isFetchingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load'}
              </button>
            </div>
            {urlError && <p className="text-[11px] text-red-500">{urlError}</p>}
          </form>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none',
              isDragging
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-500/5'
                : error
                ? 'border-red-400 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/5 hover:border-red-500'
                : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/40 hover:bg-slate-50/80 dark:hover:bg-[#0d1428] hover:border-slate-400 dark:hover:border-slate-700 shadow-sm'
            )}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 text-blue-600 dark:text-blue-400 mb-3 shadow-sm">
              <UploadCloud className="w-6 h-6" />
            </div>

            <h4 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {isDragging ? 'Drop satellite imagery here' : 'Drop satellite imagery here or click to browse'}
            </h4>

            <p className="text-[11px] text-slate-500 text-center max-w-xs mb-3">
              {sublabel}
            </p>

            <span className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700/60 transition-colors shadow-sm">
              Browse Imagery Files
            </span>
          </div>
        )
      ) : image.status === 'uploading' ? (
        <div className="flex flex-col p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-900 dark:text-slate-200 truncate max-w-xs">
                  {image.file.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Ingesting and verifying raster headers...
                </span>
              </div>
            </div>
            <button
              onClick={onRemove}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Cancel Upload"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 dark:to-cyan-400 h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${image.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
            <span>Progress</span>
            <span className="font-mono font-medium">{Math.round(image.progress)}%</span>
          </div>
        </div>
      ) : image.status === 'uploaded' ? (
        <div className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/90 shadow-sm transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Preview Thumbnail / Fallback Icon */}
              <div className="relative w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                {image.previewUrl && !image.file.name.endsWith('.tif') && !image.file.name.endsWith('.tiff') ? (
                  <img
                    src={image.previewUrl}
                    alt={image.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileImage className="w-6 h-6 text-blue-600 dark:text-cyan-400" />
                )}
                <div className="absolute bottom-0 right-0 p-0.5 bg-emerald-500 rounded-tl">
                  <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                </div>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {image.file.name}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  <span>{formatSize(image.file.size)}</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-sans font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Replace / Remove */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors shadow-sm"
                title="Replace imagery file"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="Remove imagery file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metadata Sub-panel */}
          {showMetadata && image.metadata && (
            <ImageMetadataPanel metadata={image.metadata} />
          )}
        </div>
      ) : (
        /* Error state */
        <div className="flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{image.error || 'Upload failed. Please check file format.'}</span>
          </div>
          <button
            onClick={onRemove}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inline Form Error */}
      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
