import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';

interface NewAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPreset: (presetId: string) => void;
  onUploadFiles?: (files: File[]) => void;
}

export function NewAnalysisModal({
  isOpen,
  onClose,
  onLoadPreset,
  onUploadFiles,
}: NewAnalysisModalProps) {
  const { t } = useTranslation();
  const [selectedPreset, setSelectedPreset] = useState<string>('change');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const presets = [
    {
      id: 'change',
      title: 'Bi-Temporal Change Detection',
      description: 'Sentinel-2 Pair (2025 vs 2026) showing urban growth & land clearing',
      icon: '🛰️',
      badge: 'Recommended',
    },
    {
      id: 'grounding',
      title: 'Suburban Object Grounding',
      description: 'High-resolution optical scene for building & road footprint segmentation',
      icon: '🎯',
      badge: '47 Structures',
    },
    {
      id: 'optical_sar',
      title: 'Optical + SAR Dual Sensor',
      description: 'Multispectral RGB combined with Sentinel-1 Synthetic Aperture Radar',
      icon: '📡',
      badge: 'Radar Fusion',
    },
    {
      id: 'vqa',
      title: 'Agricultural Land-Cover VQA',
      description: 'Farm parcels and rural infrastructure visual question answering',
      icon: '🌾',
      badge: 'Natural Language',
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(filesArray);
    }
  };

  const handleApply = () => {
    if (selectedFiles.length > 0 && onUploadFiles) {
      onUploadFiles(selectedFiles);
    } else {
      onLoadPreset(selectedPreset);
    }
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0a0f1e] border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('newAnalysis.title')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('newAnalysis.subtitle')}
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

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.tif,.tiff"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Upload Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer mb-4',
            isDragging
              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-600/20 scale-[1.01]'
              : selectedFiles.length > 0
              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-600/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-900/40'
          )}
        >
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-cyan-400 mx-auto flex items-center justify-center mb-2">
            {selectedFiles.length > 0 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {selectedFiles.length > 0
              ? `${selectedFiles.length} file(s) selected: ${selectedFiles.map((f) => f.name).join(', ')}`
              : t('newAnalysis.dragDrop')}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {selectedFiles.length > 0
              ? 'Click to change image or click "Start Analysis" below'
              : t('newAnalysis.supportedFormats')}
          </p>
        </div>

        {/* Presets Grid */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t('newAnalysis.selectBenchmark')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((p) => {
              const isSelected = selectedPreset === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPreset(p.id)}
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-xl border cursor-pointer transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-600/10 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">{p.icon}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {p.badge}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                      {p.title}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      {p.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-cyan-400 font-semibold mt-2 pt-1 border-t border-blue-200/50 dark:border-blue-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('newAnalysis.readyToLoad')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-colors"
          >
            {t('newAnalysis.startAnalysis')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
