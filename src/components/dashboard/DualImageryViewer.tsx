import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus,
  Minus,
  Search,
  X,
  Crosshair,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  RotateCcw,
  Layers,
  SplitSquareVertical,
  Grid,
  MapPin,
  Ruler,
  Camera,
  Move,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import type {
  VisualizationLayer,
  MapRegion,
  ImagerySource,
  ComparisonMode,
  OpticalSarMode,
  GroundingBox,
} from '../../types/visualization';
import { GroundingOverlay } from './GroundingOverlay';

interface DualImageryViewerProps {
  modeCategory: 'single' | 'compare' | 'fusion';
  onCategoryChange: (cat: 'single' | 'compare' | 'fusion') => void;
  detectedFeaturesCount?: number;
  onInspectRegion?: (regionId: string) => void;
  /** Phase 2: Layer visibility/opacity state */
  layers?: VisualizationLayer[];
  /** Phase 2: Map regions for overlay rendering */
  regions?: MapRegion[];
  /** Phase 2: Currently highlighted region (evidence ↔ viewer linking) */
  highlightedRegionId?: string | null;
  /** Phase 2: Callback when user clicks a region on the viewer */
  onRegionClick?: (regionId: string) => void;

  /** Phase 3: Centralized imagery metadata from DashboardPage */
  imagerySources?: {
    t0: ImagerySource;
    t1: ImagerySource;
    t0Path?: string;
    t1Path?: string;
  };
  /** Phase 3: Comparison mode (swipe vs side-by-side) */
  comparisonMode?: ComparisonMode;
  onComparisonModeChange?: (mode: ComparisonMode) => void;
  /** Phase 3: Optical + SAR display mode */
  opticalSarMode?: OpticalSarMode;
  onOpticalSarModeChange?: (mode: OpticalSarMode) => void;
  /** Phase 3: Grounding boxes */
  groundingBoxes?: GroundingBox[];
  selectedGroundingId?: string | null;
  onSelectGrounding?: (groundingId: string, regionId: string) => void;
}

export function DualImageryViewer({
  modeCategory,
  onCategoryChange,
  detectedFeaturesCount: _detectedFeaturesCount = 3,
  onInspectRegion,
  layers = [],
  regions = [],
  highlightedRegionId = null,
  onRegionClick,
  imagerySources,
  comparisonMode = 'swipe',
  onComparisonModeChange,
  opticalSarMode = 'combined',
  onOpticalSarModeChange,
  groundingBoxes = [],
  selectedGroundingId = null,
  onSelectGrounding,
}: DualImageryViewerProps) {
  // Centralized imagery paths & dates from props (no hardcoded dates)
  const t0Date = imagerySources?.t0?.acquisitionDate || '2025-03-12';
  const t1Date = imagerySources?.t1?.acquisitionDate || '2026-03-12';
  const t0Path = imagerySources?.t0Path || '/imagery/sat_before.jpg';
  const t1Path = imagerySources?.t1Path || '/imagery/sat_after.jpg';

  // Split slider position (percentage 0 to 100)
  const [sliderPosition, setSliderPosition] = useState(52);
  const [isDragging, setIsDragging] = useState(false);
  // Zoom state — strictly local to imagery content layer
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showOverlays, setShowOverlays] = useState(true);
  const [activeLayer, setActiveLayer] = useState<'rgb' | 'sar' | 'infrared'>('rgb');

  // Fullscreen / Maximized viewer state
  const [isMaximized, setIsMaximized] = useState(false);

  // Phase 2: Map control states
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [mockCoords, setMockCoords] = useState({ lat: 28.6139, lng: 77.209 });
  const [showMiniMap, setShowMiniMap] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Escape key listener to exit maximized mode
  useEffect(() => {
    if (!isMaximized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMaximized(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMaximized]);

  // Lock body scroll in maximized mode
  useEffect(() => {
    if (isMaximized) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMaximized]);

  const handleSliderMove = useCallback((clientX: number) => {
    const target = stageRef.current || containerRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
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

  // Zoom control handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.0, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1.0, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoomLevel(1.0);
  const handleFitToImage = () => setZoomLevel(1.0);

  // Native non-passive wheel event listener:
  // - Stops event propagation to parent page scroll containers
  // - Prevents browser default page zoom (Ctrl+wheel / trackpad pinch) and vertical page scroll
  // - Affects ONLY satellite imagery zoomLevel
  // - Mouse wheel outside this container continues normal page scrolling naturally
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // 1. MUST call preventDefault on non-passive listener to cancel native browser zoom & page scroll
      e.preventDefault();
      // 2. Stop event from bubbling to parent scrollable containers
      e.stopPropagation();

      // 3. Zoom satellite imagery locally
      const zoomStep = 0.15;
      if (e.deltaY < 0) {
        // Scroll up -> Zoom in (max 3.0x)
        setZoomLevel((z) => Math.min(3.0, +(z + zoomStep).toFixed(2)));
      } else if (e.deltaY > 0) {
        // Scroll down -> Zoom out (min 1.0x)
        setZoomLevel((z) => Math.max(1.0, +(z - zoomStep).toFixed(2)));
      }
    };

    // passive: false is REQUIRED so that e.preventDefault() stops browser page zoom
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // Mock coordinate update on mouse move over viewer
  const handleViewerMouseMove = useCallback((e: React.MouseEvent) => {
    const target = stageRef.current || containerRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    // Mock coordinate range around New Delhi
    setMockCoords({
      lat: +(28.60 + yRatio * 0.03).toFixed(4),
      lng: +(77.20 + xRatio * 0.02).toFixed(4),
    });
  }, []);

  // Mock screenshot simulation
  const handleScreenshot = () => {
    const link = document.createElement('a');
    link.download = `SatQuery_Viewport_${Date.now()}.txt`;
    link.href = URL.createObjectURL(new Blob([
      `SatQuery AI — Viewport Export (Demo)\nTimestamp: ${new Date().toISOString()}\nZoom: ${zoomLevel}x\nCenter: ${mockCoords.lat}°N, ${mockCoords.lng}°E\nMode: ${modeCategory}\n\nNote: This is a demo export. Real imagery export will be available with backend integration.`
    ], { type: 'text/plain' }));
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Compute scale bar label based on zoom
  const getScaleBarLabel = () => {
    if (zoomLevel >= 2.5) return '100 m';
    if (zoomLevel >= 2) return '250 m';
    if (zoomLevel >= 1.5) return '500 m';
    return '1 km';
  };

  // Check if overlay type is visible from layer state
  const isOverlayVisible = (overlayType: string) => {
    if (!showOverlays) return false;
    const layer = layers.find((l) => l.type === overlayType && l.category === 'overlay');
    return layer ? layer.visible : true;
  };

  const getOverlayOpacity = (overlayType: string) => {
    const layer = layers.find((l) => l.type === overlayType && l.category === 'overlay');
    return layer ? layer.opacity / 100 : 0.8;
  };

  // Region click handler
  const handleRegionClick = (regionId: string) => {
    if (onRegionClick) {
      onRegionClick(regionId);
    } else if (onInspectRegion) {
      onInspectRegion(regionId);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 w-full select-none',
        isMaximized && 'fixed inset-0 z-40 bg-[#060a14] p-3 sm:p-5 h-screen w-screen overflow-hidden'
      )}
    >
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
          {isMaximized && (
            <span className="text-[11px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 mr-1 hidden sm:inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              FULLSCREEN WORKSPACE
            </span>
          )}

          <button
            onClick={() => setSliderPosition(50)}
            className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            title="Split 50/50"
            aria-label="Split 50/50"
          >
            <SplitSquareVertical className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMeasuring(!isMeasuring)}
            className={cn(
              'p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors',
              isMeasuring && 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
            )}
            title={isMeasuring ? 'Disable Measure Tool (Demo)' : 'Measure Distance (Demo)'}
            aria-label="Toggle measure tool"
          >
            <Ruler className="w-4 h-4" />
          </button>

          <button
            onClick={handleScreenshot}
            className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            title="Capture Viewport Screenshot (Demo)"
            aria-label="Capture screenshot"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveLayer(activeLayer === 'sar' ? 'rgb' : 'sar')}
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
            title="Reset Map View (1.0x)"
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
            onClick={() => setIsMaximized(!isMaximized)}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isMaximized
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30'
                : 'hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
            )}
            title={isMaximized ? 'Exit Fullscreen (Esc)' : 'Maximize Viewport (Fullscreen)'}
            aria-label={isMaximized ? 'Exit Fullscreen' : 'Maximize Viewport'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {isMaximized && (
            <button
              onClick={() => setIsMaximized(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors shadow-sm ml-1"
              title="Exit Fullscreen (Esc)"
              aria-label="Exit Fullscreen"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit Fullscreen</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Imagery Area: Dual Satellite Viewer & Beside Detail Inset */}
      <div
        className={cn(
          'w-full items-stretch',
          isMaximized ? 'flex-1 flex flex-col min-h-0' : 'grid grid-cols-1 xl:grid-cols-12 gap-3'
        )}
      >
        {/* Fixed Viewport Container (never scales) */}
        <div
          ref={containerRef}
          className={cn(
            'relative rounded-xl border border-slate-300 dark:border-slate-800 bg-[#060a14] overflow-hidden shadow-md flex items-center justify-center group select-none',
            isMaximized ? 'flex-1 w-full h-full min-h-0' : 'xl:col-span-8 h-[340px] sm:h-[380px] lg:h-[400px]'
          )}
          style={{ cursor: isMeasuring ? 'crosshair' : isDragging ? 'col-resize' : 'default' }}
          onMouseMove={handleViewerMouseMove}
        >
          {/* Aspect-Ratio Preserving Imagery Stage (1200 x 896 intrinsic ratio) */}
          <div
            ref={stageRef}
            className="relative h-full max-w-full aspect-[1200/896] overflow-hidden flex items-center justify-center"
          >
            {/* 0. Mode-Specific In-Stage Header: Comparison Mode Toggle (Swipe vs Side-by-Side) */}
            {modeCategory === 'compare' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center p-0.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-md pointer-events-auto">
                <button
                  type="button"
                  onClick={() => onComparisonModeChange?.('swipe')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
                    comparisonMode === 'swipe'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white'
                  )}
                  title="Swipe comparison mode"
                  aria-label="Swipe comparison mode"
                >
                  <SplitSquareVertical className="w-3 h-3" />
                  <span>Swipe</span>
                </button>
                <button
                  type="button"
                  onClick={() => onComparisonModeChange?.('side_by_side')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
                    comparisonMode === 'side_by_side'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white'
                  )}
                  title="Side-by-side comparison mode"
                  aria-label="Side-by-side comparison mode"
                >
                  <Grid className="w-3 h-3" />
                  <span>Side-by-Side</span>
                </button>
              </div>
            )}

            {/* Mode-Specific In-Stage Header: Optical / SAR / Combined Multimodal Toggle */}
            {modeCategory === 'fusion' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center p-0.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-md pointer-events-auto">
                <button
                  type="button"
                  onClick={() => onOpticalSarModeChange?.('optical')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                    opticalSarMode === 'optical'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white'
                  )}
                  title="Show Optical imagery (RGB)"
                  aria-label="Show Optical imagery (RGB)"
                >
                  Optical
                </button>
                <button
                  type="button"
                  onClick={() => onOpticalSarModeChange?.('sar')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                    opticalSarMode === 'sar'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white'
                  )}
                  title="Show DEMO SAR visualization treatment"
                  aria-label="Show DEMO SAR visualization treatment"
                >
                  SAR (Demo)
                </button>
                <button
                  type="button"
                  onClick={() => onOpticalSarModeChange?.('combined')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                    opticalSarMode === 'combined'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white'
                  )}
                  title="Show Combined comparative view"
                  aria-label="Show Combined comparative view"
                >
                  Combined
                </button>
              </div>
            )}

            {/* Mode Badge for Optical & DEMO SAR view */}
            {modeCategory === 'fusion' && opticalSarMode === 'sar' && (
              <div className="absolute top-12 left-3 z-20 px-2 py-0.5 rounded bg-purple-950/85 backdrop-blur-md border border-purple-700/60 text-[10px] font-mono text-purple-200 shadow-md flex items-center gap-1.5 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>DEMO SAR — Visual treatment only</span>
              </div>
            )}

            {modeCategory === 'fusion' && opticalSarMode === 'optical' && (
              <div className="absolute top-12 left-3 z-20 px-2 py-0.5 rounded bg-blue-950/85 backdrop-blur-md border border-blue-700/60 text-[10px] font-mono text-cyan-200 shadow-md flex items-center gap-1.5 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>OPTICAL (RGB)</span>
              </div>
            )}

            {/* Side-by-Side Comparison Layout (Desktop/Tablet: side-by-side; Mobile: stacked) */}
            {modeCategory === 'compare' && comparisonMode === 'side_by_side' ? (
              <div className="w-full h-full flex flex-col md:flex-row gap-2 p-2 pt-11">
                {/* Left: BEFORE (T0) */}
                <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden border border-slate-800 bg-[#060a14] flex items-center justify-center">
                  <div
                    className="w-full h-full transition-transform duration-150 ease-out origin-center flex items-center justify-center pointer-events-none"
                    style={{ transform: `scale(${zoomLevel})` }}
                  >
                    <img
                      src={t0Path}
                      alt={`Previous Satellite Imagery (${t0Date})`}
                      className="w-full h-full object-contain select-none pointer-events-none"
                    />
                  </div>
                  <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-200 pointer-events-none">
                    BEFORE • T0 ({t0Date})
                  </div>
                </div>

                {/* Right: AFTER (T1) with synchronized overlays */}
                <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden border border-slate-800 bg-[#060a14] flex items-center justify-center">
                  <div
                    className="w-full h-full transition-transform duration-150 ease-out origin-center flex items-center justify-center pointer-events-none"
                    style={{ transform: `scale(${zoomLevel})` }}
                  >
                    <img
                      src={t1Path}
                      alt={`Current Satellite Imagery (${t1Date})`}
                      className="w-full h-full object-contain select-none pointer-events-none"
                    />
                    {/* SVG Overlays in Side-by-Side After view */}
                    {showOverlays && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                        viewBox="0 0 800 500"
                        preserveAspectRatio="none"
                      >
                        {isOverlayVisible('changed_regions') && (
                          <g style={{ opacity: getOverlayOpacity('changed_regions') }}>
                            {regions
                              .filter((r) => r.type === 'changed_area' && r.polygonPoints)
                              .map((region) => (
                                <polygon
                                  key={region.id}
                                  points={region.polygonPoints}
                                  fill={highlightedRegionId === region.id ? 'rgba(250, 204, 21, 0.4)' : 'rgba(250, 204, 21, 0.18)'}
                                  stroke={highlightedRegionId === region.id ? '#fef08a' : '#facc15'}
                                  strokeWidth={highlightedRegionId === region.id ? '3.5' : '2.5'}
                                  className="cursor-pointer pointer-events-auto transition-all duration-200"
                                  onClick={() => handleRegionClick(region.id)}
                                />
                              ))}
                          </g>
                        )}
                        {isOverlayVisible('grounding') && (
                          <GroundingOverlay
                            boxes={groundingBoxes}
                            visible={isOverlayVisible('grounding')}
                            opacity={getOverlayOpacity('grounding')}
                            selectedGroundingId={selectedGroundingId}
                            highlightedRegionId={highlightedRegionId}
                            onSelectGrounding={onSelectGrounding}
                          />
                        )}
                      </svg>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-200 pointer-events-none">
                    AFTER • T1 ({t1Date})
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Base After/Current Imagery Layer (Zoom transform applied HERE ONLY) */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="w-full h-full transition-transform duration-150 ease-out origin-center"
                    style={{ transform: `scale(${zoomLevel})` }}
                  >
                    <img
                      src={t1Path}
                      alt={`Satellite Imagery (${t1Date})`}
                      className={cn(
                        'w-full h-full object-contain select-none pointer-events-none',
                        modeCategory === 'fusion' && opticalSarMode === 'sar' && 'grayscale contrast-150 brightness-95'
                      )}
                    />
                  </div>
                </div>

                {/* 2. Compare / Split Image Layer (Clipped to sliderPosition% of viewport, zoom transform applied HERE ONLY) */}
                {modeCategory !== 'single' && !(modeCategory === 'fusion' && (opticalSarMode === 'optical' || opticalSarMode === 'sar')) && (
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{
                      clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                      WebkitClipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                    }}
                  >
                    <div
                      className="w-full h-full transition-transform duration-150 ease-out origin-center"
                      style={{ transform: `scale(${zoomLevel})` }}
                    >
                      <img
                        src={modeCategory === 'fusion' ? t0Path : t0Path}
                        alt={modeCategory === 'fusion' ? 'Optical Imagery' : `Previous Satellite Imagery (${t0Date})`}
                        className="w-full h-full object-contain select-none pointer-events-none"
                      />
                    </div>
                  </div>
                )}

            {/* 3. SVG Overlays & Evidence Highlights (Zoom transform applied HERE so overlays remain 100% aligned!) */}
            {showOverlays && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                  className="w-full h-full transition-transform duration-150 ease-out origin-center pointer-events-none"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <svg
                    className="w-full h-full pointer-events-none z-10"
                    viewBox="0 0 800 500"
                    preserveAspectRatio="none"
                  >
                    {/* Changed Region Overlays */}
                    {isOverlayVisible('changed_regions') && (
                      <g style={{ opacity: getOverlayOpacity('changed_regions') }}>
                        {regions
                          .filter((r) => r.type === 'changed_area' && r.polygonPoints)
                          .map((region) => (
                            <g key={region.id}>
                              <polygon
                                points={region.polygonPoints}
                                fill={highlightedRegionId === region.id ? 'rgba(250, 204, 21, 0.4)' : 'rgba(250, 204, 21, 0.18)'}
                                stroke={highlightedRegionId === region.id ? '#fef08a' : '#facc15'}
                                strokeWidth={highlightedRegionId === region.id ? '3.5' : '2.5'}
                                className="cursor-pointer pointer-events-auto transition-all duration-200"
                                onClick={() => handleRegionClick(region.id)}
                              />
                              {region.bounds && (
                                <rect
                                  x={region.bounds.x}
                                  y={region.bounds.y}
                                  width={region.bounds.width}
                                  height={region.bounds.height}
                                  fill="none"
                                  stroke={highlightedRegionId === region.id ? '#fef08a' : '#eab308'}
                                  strokeWidth="1.2"
                                  strokeDasharray="4 2"
                                />
                              )}
                            </g>
                          ))}
                      </g>
                    )}

                    {/* Building Detection Overlays */}
                    {isOverlayVisible('buildings') && (
                      <g style={{ opacity: getOverlayOpacity('buildings') }}>
                        {regions
                          .filter((r) => r.type === 'building')
                          .map((region) => (
                            <rect
                              key={region.id}
                              x={region.bounds.x}
                              y={region.bounds.y}
                              width={region.bounds.width}
                              height={region.bounds.height}
                              fill={highlightedRegionId === region.id ? 'rgba(250, 204, 21, 0.5)' : 'rgba(250, 204, 21, 0.3)'}
                              stroke={highlightedRegionId === region.id ? '#fff' : '#fef08a'}
                              strokeWidth={highlightedRegionId === region.id ? '2.5' : '1.5'}
                              className="cursor-pointer pointer-events-auto transition-all duration-200"
                              onClick={() => handleRegionClick(region.id)}
                            />
                          ))}
                      </g>
                    )}

                    {/* Road Network Overlay */}
                    {isOverlayVisible('roads') && (
                      <g style={{ opacity: getOverlayOpacity('roads') }}>
                        <line x1="200" y1="350" x2="600" y2="340" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6 3" />
                        <line x1="450" y1="100" x2="460" y2="400" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="6 3" />
                      </g>
                    )}

                    {/* Vegetation Mask Overlay */}
                    {isOverlayVisible('vegetation') && (
                      <g style={{ opacity: getOverlayOpacity('vegetation') }}>
                        <rect x="100" y="150" width="200" height="180" fill="rgba(34, 197, 94, 0.15)" stroke="#22c55e" strokeWidth="1" rx="4" />
                        <rect x="650" y="280" width="120" height="140" fill="rgba(34, 197, 94, 0.12)" stroke="#22c55e" strokeWidth="1" rx="4" />
                      </g>
                    )}

                    {/* Phase 3 Grounding Boxes Overlay (shares exact coordinate system and zoom scale) */}
                    {isOverlayVisible('grounding') && (
                      <GroundingOverlay
                        boxes={groundingBoxes}
                        visible={isOverlayVisible('grounding')}
                        opacity={getOverlayOpacity('grounding')}
                        selectedGroundingId={selectedGroundingId}
                        highlightedRegionId={highlightedRegionId}
                        onSelectGrounding={onSelectGrounding}
                      />
                    )}

                    {/* Highlighted region pulse ring */}
                    {highlightedRegionId && (() => {
                      const hl = regions.find(r => r.id === highlightedRegionId);
                      if (!hl) return null;
                      const cx = hl.bounds.x + hl.bounds.width / 2;
                      const cy = hl.bounds.y + hl.bounds.height / 2;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={Math.max(hl.bounds.width, hl.bounds.height) * 0.6}
                          fill="none"
                          stroke="#fef08a"
                          strokeWidth="1.5"
                          className="animate-ping"
                          style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: '2s' }}
                        />
                      );
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* 4. Interactive Split Divider & Drag Handle (Fixed on stageRef, NOT scaled) */}
            {modeCategory !== 'single' && !(modeCategory === 'compare' && comparisonMode === 'side_by_side') && !(modeCategory === 'fusion' && (opticalSarMode === 'optical' || opticalSarMode === 'sar')) && (
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

            {/* 5. Fixed Temporal & Modal Labels (Fixed on stageRef, NOT scaled) */}
            {modeCategory !== 'single' && !(modeCategory === 'compare' && comparisonMode === 'side_by_side') && (
              <>
                <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-200 shadow-md pointer-events-none">
                  {modeCategory === 'fusion' ? 'Optical Imagery (RGB)' : `Previous Image (${t0Date})`}
                </div>
                <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-200 shadow-md pointer-events-none">
                  {modeCategory === 'fusion' ? 'DEMO SAR (Visual treatment)' : `Current Image (${t1Date})`}
                </div>
              </>
            )}

            {/* Multimodal Observation Banner for Optical + SAR mode */}
            {modeCategory === 'fusion' && (
              <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-md bg-slate-950/90 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-300 shadow-md pointer-events-none text-center whitespace-nowrap max-w-[90%] truncate">
                <span className="text-cyan-400 font-semibold mr-1.5">[DEMO MULTIMODAL]</span>
                <span>Comparative multimodal view: Optical and SAR views presented together for comparative analysis.</span>
              </div>
            )}
          </>
        )}
      </div>

          {/* 6. Fixed Floating Map Navigation Controls (Fixed on canvas, NOT scaled) */}
          <div className="absolute top-4 left-3 z-20 flex flex-col rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-1 shadow-lg text-slate-200 divide-y divide-slate-800">
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition-colors"
              title="Zoom in (+)"
              aria-label="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition-colors"
              title="Zoom out (-)"
              aria-label="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition-colors"
              title="Reset View (1.0x)"
              aria-label="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitToImage}
              className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition-colors"
              title="Fit to Image"
              aria-label="Fit to Image"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className="p-1.5 hover:bg-slate-800 hover:text-red-400 rounded transition-colors"
              title="Toggle masks / overlays"
              aria-label="Toggle masks"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 7. Fixed Floating Quick Tools (Fixed on canvas, NOT scaled) */}
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

          {/* 8. Fixed Coordinate Readout (Bottom-left inside canvas, NOT scaled) */}
          <div className="absolute bottom-12 left-3 z-20 flex items-center gap-2 px-2 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-300 shadow-sm">
            <Move className="w-3 h-3 text-slate-400" />
            <span>{mockCoords.lat.toFixed(4)}°N, {mockCoords.lng.toFixed(4)}°E</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Zoom {zoomLevel.toFixed(1)}x</span>
            {isMeasuring && (
              <>
                <span className="text-slate-500">|</span>
                <span className="text-amber-400">📏 Demo: ~1.2 km</span>
              </>
            )}
          </div>

          {/* 9. Fixed Scale Bar (Bottom-right inside canvas, NOT scaled) */}
          <div className="absolute bottom-12 right-3 z-20 flex flex-col items-end gap-0.5">
            <div className="flex items-end gap-1">
              <div className="w-16 h-[3px] bg-white/80 rounded-full shadow-sm" />
              <span className="text-[9px] font-mono text-slate-300">{getScaleBarLabel()}</span>
            </div>
          </div>

          {/* 10. Fixed Mini-map Inset (Top-right corner, NOT scaled) */}
          {showMiniMap && (
            <div
              className="absolute top-4 right-14 z-20 w-[72px] h-[54px] rounded-md border border-slate-700/80 bg-slate-950/90 backdrop-blur-sm shadow-lg overflow-hidden cursor-pointer"
              onClick={() => setShowMiniMap(false)}
              title="Mini-map (click to hide)"
            >
              <img
                src="/imagery/sat_after.jpg"
                alt="Mini-map overview"
                className="w-full h-full object-cover opacity-60"
              />
              {/* Viewport indicator rect that shrinks as zoomLevel increases */}
              <div
                className="absolute border border-cyan-400/80 bg-cyan-400/10 rounded-sm"
                style={{
                  width: `${Math.max(20, 100 / zoomLevel)}%`,
                  height: `${Math.max(20, 100 / zoomLevel)}%`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          )}
        </div>

        {/* Beside Map Viewport: Zoomed Detail Inspection Tile (hidden in maximized fullscreen mode) */}
        {!isMaximized && (
          <div className="xl:col-span-4 relative rounded-xl border border-slate-300 dark:border-slate-800 bg-[#060a14] overflow-hidden shadow-md h-[340px] sm:h-[380px] lg:h-[400px] flex items-center justify-center p-3">
            {/* Aspect-Ratio Preserving Detail Stage (1024 x 1024 square) */}
            <div className="relative h-full max-w-full aspect-square overflow-hidden flex flex-col justify-between p-3 rounded-lg">
              {/* Background Detail Satellite Imagery */}
              <img
                src="/imagery/sat_detail.jpg"
                alt="High-resolution localized satellite tile"
                className="absolute inset-0 w-full h-full object-contain opacity-90 select-none"
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
                <span className="text-emerald-400 font-semibold">High Coherence (Demo)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
