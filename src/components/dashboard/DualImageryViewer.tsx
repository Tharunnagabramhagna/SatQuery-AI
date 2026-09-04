import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus,
  Minus,
  Search,
  X,
  Crosshair,
  Maximize2,
  SlidersHorizontal,
  RotateCcw,
  Layers,
  SplitSquareVertical,
  Grid,
  MapPin,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface DualImageryViewerProps {
  modeCategory: 'single' | 'compare' | 'fusion';
  onCategoryChange: (cat: 'single' | 'compare' | 'fusion') => void;
  detectedFeaturesCount?: number;
  onInspectRegion?: (regionId: string) => void;
}

export function DualImageryViewer({
  modeCategory,
  onCategoryChange,
  detectedFeaturesCount: _detectedFeaturesCount = 3,
  onInspectRegion,
}: DualImageryViewerProps) {
  // Split slider position (percentage 0 to 100)
  const [sliderPosition, setSliderPosition] = useState(52);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showOverlays, setShowOverlays] = useState(true);
  const [activeLayer, setActiveLayer] = useState<'rgb' | 'sar' | 'infrared'>('rgb');
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleSliderMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (offsetX / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleSliderMove(e.clientX);
      }
    };
    const onMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        handleSliderMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleSliderMove]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.5, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="flex flex-col gap-2.5 w-full select-none">
      {/* Sub-mode Tabs & Map Action Bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        {/* Left Sub-mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-200/60 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-800">
          <button
            onClick={() => onCategoryChange('single')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
              modeCategory === 'single'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-400 font-semibold shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <span className="w-3.5 h-3.5 border border-current rounded-sm flex items-center justify-center text-[9px]">■</span>
            <span>Single Image</span>
          </button>

          <button
            onClick={() => onCategoryChange('compare')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
              modeCategory === 'compare'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-400 font-semibold shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Compare Images</span>
          </button>

          <button
            onClick={() => onCategoryChange('fusion')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
              modeCategory === 'fusion'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-400 font-semibold shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Optical + SAR</span>
          </button>
        </div>

        {/* Right Map Action Buttons */}
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setSliderPosition(50)}
            className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            title="Split 50/50"
            aria-label="Split 50/50"
          >
            <SplitSquareVertical className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveLayer(activeLayer === 'rgb' ? 'sar' : 'rgb')}
            className={cn(
              'p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors',
              activeLayer === 'sar' && 'text-blue-600 dark:text-cyan-400'
            )}
            title="Toggle SAR Spectral Mode"
            aria-label="Toggle SAR Spectral Mode"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            title="Reset Map View"
            aria-label="Reset Map View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={cn(
              'p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors',
              showOverlays ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-400'
            )}
            title="Toggle Polygon Overlays"
            aria-label="Toggle Polygon Overlays"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsDetailExpanded(!isDetailExpanded)}
            className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            title="Maximize Viewport"
            aria-label="Maximize Viewport"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Imagery Area: Dual Satellite Viewer & Beside Detail Inset */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 w-full items-stretch">
        {/* Dual Split Satellite Comparison Canvas */}
        <div
          ref={containerRef}
          className="xl:col-span-8 relative rounded-xl border border-slate-300 dark:border-slate-800 bg-[#060a14] overflow-hidden shadow-md h-[340px] sm:h-[380px] lg:h-[400px] flex items-center justify-center group"
          style={{ cursor: isDragging ? 'col-resize' : 'default' }}
        >
          {/* Zoom wrapper for zoom scale */}
          <div
            className="relative w-full h-full transition-transform duration-150 ease-out origin-center"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {/* Background: Current/After Image (Full width base) */}
            <img
              src="/imagery/sat_after.jpg"
              alt="Current Satellite Imagery (2026)"
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            />

            {/* Left Clip: Previous/Before Image (Clipped at sliderPosition %) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                width: `${modeCategory === 'single' ? 0 : sliderPosition}%`,
                display: modeCategory === 'single' ? 'none' : 'block',
              }}
            >
              <img
                src="/imagery/sat_before.jpg"
                alt="Previous Satellite Imagery (2025)"
                className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                style={{
                  width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
                  maxWidth: 'none',
                }}
              />
            </div>

            {/* SVG Overlays: Golden Polygons & Bounding Boxes */}
            {showOverlays && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                viewBox="0 0 800 500"
                preserveAspectRatio="none"
              >
                {/* Changed Region Golden Boxes */}
                <g className="animate-pulse-slow">
                  {/* Region 1: Northern new warehouse complex */}
                  <polygon
                    points="420,120 540,110 570,220 440,240"
                    fill="rgba(250, 204, 21, 0.18)"
                    stroke="#facc15"
                    strokeWidth="2.5"
                    strokeDasharray="none"
                  />
                  <rect
                    x="420"
                    y="110"
                    width="150"
                    height="130"
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="1.2"
                    strokeDasharray="4 2"
                  />

                  {/* Region 2: Central structural foundation */}
                  <polygon
                    points="370,260 480,250 510,340 390,360"
                    fill="rgba(245, 158, 11, 0.22)"
                    stroke="#fbbf24"
                    strokeWidth="2.2"
                  />

                  {/* Region 3: Eastern cleared parcel */}
                  <polygon
                    points="590,160 670,150 680,260 600,270"
                    fill="rgba(250, 204, 21, 0.15)"
                    stroke="#facc15"
                    strokeWidth="2"
                  />

                  {/* Detected building footprint boxes */}
                  <rect x="440" y="130" width="35" height="40" fill="rgba(250, 204, 21, 0.3)" stroke="#fef08a" strokeWidth="1.5" />
                  <rect x="490" y="145" width="40" height="45" fill="rgba(250, 204, 21, 0.3)" stroke="#fef08a" strokeWidth="1.5" />
                  <rect x="410" y="275" width="30" height="35" fill="rgba(250, 204, 21, 0.3)" stroke="#fef08a" strokeWidth="1.5" />
                  <rect x="455" y="280" width="38" height="42" fill="rgba(250, 204, 21, 0.3)" stroke="#fef08a" strokeWidth="1.5" />
                </g>
              </svg>
            )}
          </div>

          {/* Interactive Split Divider & Drag Handle */}
          {modeCategory !== 'single' && (
            <div
              className="absolute top-0 bottom-0 z-20"
              style={{ left: `${sliderPosition}%` }}
            >
              {/* Divider Line */}
              <div className="absolute top-0 bottom-0 -left-0.5 w-1 bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.6)] cursor-col-resize" />

              {/* Drag Handle Circle */}
              <div
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-900/90 text-white border-2 border-white shadow-xl flex items-center justify-center cursor-col-resize hover:scale-110 active:scale-95 transition-transform"
                title="Drag to compare before & after satellite imagery"
              >
                <span className="text-[10px] font-bold tracking-tighter select-none flex items-center justify-center">
                  &lt;&gt;
                </span>
              </div>
            </div>
          )}

          {/* Bottom Temporal Labels */}
          {modeCategory !== 'single' && (
            <>
              <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-200 shadow-md">
                Previous Image (2025-03-12)
              </div>
              <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-200 shadow-md">
                Current Image (2026-03-12)
              </div>
            </>
          )}

          {/* Left Floating Map Navigation Controls */}
          <div className="absolute top-4 left-3 z-20 flex flex-col rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-1 shadow-lg text-slate-200 divide-y divide-slate-800">
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition-colors"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition-colors"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition-colors"
              title="Reset scale"
              aria-label="Reset scale"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className="p-1.5 hover:bg-slate-800 hover:text-red-400 rounded transition-colors"
              title="Clear / toggle masks"
              aria-label="Clear masks"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Floating Quick Tools */}
          <div className="absolute top-4 right-3 z-20 flex flex-col rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-1 shadow-lg text-slate-200 divide-y divide-slate-800">
            <button
              onClick={() => onInspectRegion?.('region-1')}
              className="p-1.5 hover:bg-slate-800 hover:text-cyan-400 rounded transition-colors"
              title="Target locator"
              aria-label="Target locator"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className="p-1.5 hover:bg-slate-800 hover:text-yellow-400 rounded transition-colors"
              title="Draw / Edit Bounding Box"
              aria-label="Draw bounding box"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveLayer(activeLayer === 'sar' ? 'rgb' : 'sar')}
              className="p-1.5 hover:bg-slate-800 hover:text-blue-400 rounded transition-colors"
              title="Switch radar bands"
              aria-label="Switch radar bands"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Beside Map Viewport: Zoomed Detail Inspection Tile */}
        <div className="xl:col-span-4 relative rounded-xl border border-slate-300 dark:border-slate-800 bg-[#060a14] overflow-hidden shadow-md h-[340px] sm:h-[380px] lg:h-[400px] flex flex-col justify-between p-3">
          {/* Background Detail Satellite Imagery */}
          <img
            src="/imagery/sat_detail.jpg"
            alt="High-resolution localized satellite tile"
            className="absolute inset-0 w-full h-full object-cover opacity-90 select-none"
          />

          {/* Golden Polygon Overlays on Detail Tile */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            viewBox="0 0 400 400"
          >
            <polygon
              points="140,80 280,70 310,210 160,230"
              fill="rgba(250, 204, 21, 0.22)"
              stroke="#facc15"
              strokeWidth="2.5"
            />
            <polygon
              points="170,240 260,230 280,310 190,320"
              fill="rgba(250, 204, 21, 0.2)"
              stroke="#facc15"
              strokeWidth="2"
            />
          </svg>

          {/* Top Pill: Detected Buildings Badge */}
          <div className="relative z-20 flex items-center justify-between w-full">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-400/90 text-slate-950 text-xs font-bold shadow-md">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-950" />
              <span>Detected Buildings</span>
            </div>

            {/* Quick action: Crosshair locator */}
            <button
              onClick={() => onInspectRegion?.('zoom-detail')}
              className="p-1 rounded-md bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors shadow-sm"
              title="Inspect detail bounds"
            >
              <MapPin className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Floating Right Side Controls on Detail View */}
          <div className="relative z-20 self-end flex flex-col rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-1 shadow-lg text-slate-200 divide-y divide-slate-800">
            <button
              className="p-1.5 hover:bg-slate-800 hover:text-cyan-400 rounded transition-colors"
              title="Layer opacity"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 hover:bg-slate-800 hover:text-blue-400 rounded transition-colors"
              title="Toggle infrared"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom Inset Caption */}
          <div className="relative z-20 flex items-center justify-between px-2 py-1 rounded bg-slate-950/85 backdrop-blur-md border border-slate-800/90 text-[10px] text-slate-300 font-mono">
            <span>ROI Alpha (Sub-pixel 0.5m)</span>
            <span className="text-emerald-400 font-semibold">100% Coherence</span>
          </div>
        </div>
      </div>
    </div>
  );
}
