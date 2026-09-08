import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Palette,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import type { VisualizationLayer, BandCombination } from '../../types/visualization';
import type { BandCombinationOption } from '../../types/visualization';
import { useTranslation } from '../../hooks/useTranslation';

interface LayerControlsPanelProps {
  baseLayers: VisualizationLayer[];
  overlayLayers: VisualizationLayer[];
  bandCombinations: BandCombinationOption[];
  activeBandCombination: BandCombination;
  onBaseLayerChange: (layerId: string) => void;
  onOverlayToggle: (layerId: string) => void;
  onOverlayOpacityChange: (layerId: string, opacity: number) => void;
  onBandCombinationChange: (combo: BandCombination) => void;
}

export function LayerControlsPanel({
  baseLayers,
  overlayLayers,
  bandCombinations,
  activeBandCombination,
  onBaseLayerChange,
  onOverlayToggle,
  onOverlayOpacityChange,
  onBandCombinationChange,
}: LayerControlsPanelProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showBandSelector, setShowBandSelector] = useState(false);

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            {t('layers.title')}
          </h2>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label={isExpanded ? t('layers.collapseControls') : t('layers.expandControls')}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 mt-2">
          {/* Base Layers — Radio Group */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 mb-1.5">
              {t('layers.baseLayers')}
            </div>
            <div className="space-y-1">
              {baseLayers.map((layer) => (
                <label
                  key={layer.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-[11px]',
                    layer.visible
                      ? 'bg-blue-50 dark:bg-cyan-900/15 text-blue-700 dark:text-cyan-300 border border-blue-200/60 dark:border-cyan-700/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                  )}
                >
                  <input
                    type="radio"
                    name="base-layer"
                    checked={layer.visible}
                    onChange={() => onBaseLayerChange(layer.id)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                      layer.visible
                        ? 'border-blue-500 dark:border-cyan-400'
                        : 'border-slate-300 dark:border-slate-600'
                    )}
                  >
                    {layer.visible && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-cyan-400" />
                    )}
                  </div>
                  <span className="font-medium truncate">{layer.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Overlay Layers — Checkbox Toggles with Opacity */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 mb-1.5">
              {t('layers.overlayLayers')}
            </div>
            <div className="space-y-1.5">
              {overlayLayers.map((layer) => (
                <div key={layer.id} className="space-y-1">
                  <div className="flex items-center gap-2 px-2 py-1 rounded-md">
                    <button
                      onClick={() => onOverlayToggle(layer.id)}
                      className={cn(
                        'shrink-0 transition-colors',
                        layer.visible ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'
                      )}
                      title={layer.visible ? t('layers.hideLayer') : t('layers.showLayer')}
                    >
                      {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Color swatch */}
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 border border-slate-200/40 dark:border-slate-700/40"
                      style={{ backgroundColor: layer.color || '#94a3b8' }}
                    />

                    <span
                      className={cn(
                        'text-[11px] font-medium truncate',
                        layer.visible ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                      )}
                    >
                      {layer.name}
                    </span>

                    <span className="ml-auto text-[9px] font-mono text-slate-400 dark:text-slate-500">
                      {layer.opacity}%
                    </span>
                  </div>

                  {/* Opacity slider — visible when layer is on */}
                  {layer.visible && (
                    <div className="flex items-center gap-2 px-2 ml-6">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={layer.opacity}
                        onChange={(e) => onOverlayOpacityChange(layer.id, Number(e.target.value))}
                        className="flex-1 h-1 appearance-none bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:dark:bg-cyan-400
                          [&::-webkit-slider-thumb]:border-none [&::-webkit-slider-thumb]:cursor-pointer
                          [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full
                          [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:dark:bg-cyan-400 [&::-moz-range-thumb]:border-none"
                        title={`${layer.name} opacity: ${layer.opacity}%`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Band Combination Selector */}
          <div>
            <button
              onClick={() => setShowBandSelector(!showBandSelector)}
              className="flex items-center gap-1.5 w-full text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 mb-1.5 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <Palette className="w-3 h-3" />
              <span>{t('layers.bandCombination')}</span>
              {showBandSelector ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </button>

            {showBandSelector && (
              <div className="space-y-1">
                {bandCombinations.map((combo) => (
                  <button
                    key={combo.id}
                    onClick={() => onBandCombinationChange(combo.id)}
                    className={cn(
                      'w-full flex flex-col items-start px-2 py-1.5 rounded-md text-left transition-colors',
                      activeBandCombination === combo.id
                        ? 'bg-blue-50 dark:bg-cyan-900/15 border border-blue-200/60 dark:border-cyan-700/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                    )}
                  >
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        activeBandCombination === combo.id
                          ? 'text-blue-700 dark:text-cyan-300'
                          : 'text-slate-700 dark:text-slate-300'
                      )}
                    >
                      {combo.name}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{combo.bands}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
