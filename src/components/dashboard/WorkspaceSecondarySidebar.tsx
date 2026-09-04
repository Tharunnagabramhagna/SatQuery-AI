import React, { useState } from 'react';
import {
  Plus,
  Upload,
  Bookmark,
  ScanSearch,
  MessageSquare,
  FileText,
  GitCompare,
  MessageSquareDiff,
  Layers,
  Sparkles,
  ChevronUp,
  ChevronRight,
  Bot,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface AnalysisModeConfig {
  id: string;
  name: string;
  category: 'single' | 'compare' | 'fusion';
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  suggestions: string[];
  confidence: number;
  answerSummary: string;
  evidencePoints: string[];
  detectedFeaturesCount: number;
}

export interface AnalysisTool {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  modeId?: string;
}

export const WORKSPACE_MODES: AnalysisModeConfig[] = [
  {
    id: 'vqa',
    name: 'Single Image VQA',
    category: 'single',
    icon: MessageSquare,
    prompt: 'What infrastructure and agricultural land use patterns are present in this satellite scene?',
    suggestions: ['What objects are visible?', 'How many buildings are present?'],
    confidence: 88,
    answerSummary: 'Identified central rural settlement surrounded by organized crop parcels and unpaved arterial access roads.',
    evidencePoints: ['Central settlement cluster verified', '4 agricultural parcels segmented', 'Spectral consistency check passed'],
    detectedFeaturesCount: 14,
  },
  {
    id: 'captioning',
    name: 'Image Captioning',
    category: 'single',
    icon: FileText,
    prompt: 'Generate an exhaustive remote-sensing description of topography, land-cover, and human activity.',
    suggestions: ['Describe scene composition', 'Identify major water bodies'],
    confidence: 94,
    answerSummary: 'High-resolution aerial view displaying agricultural fields intersecting with an emerging industrial/residential perimeter.',
    evidencePoints: ['Multispectral texture analysis complete', 'Topographic elevation gradient mapped', 'Vegetation health index calibrated'],
    detectedFeaturesCount: 22,
  },
  {
    id: 'grounding',
    name: 'Object Grounding',
    category: 'single',
    icon: ScanSearch,
    prompt: 'Locate all warehouse structures, building footprints, and arterial transportation corridors.',
    suggestions: ['Locate all buildings', 'Segment paved roadways'],
    confidence: 93,
    answerSummary: 'Localized 47 individual building footprints and two primary arterial access corridors with high spatial fidelity.',
    evidencePoints: ['47 building bounding boxes fitted', 'Roadway centerline digitized', 'Sub-pixel contour localization confirmed'],
    detectedFeaturesCount: 47,
  },
  {
    id: 'change_analysis',
    name: 'Change Analysis',
    category: 'compare',
    icon: GitCompare,
    prompt: 'Identify the major changes between these two images.',
    suggestions: ['What objects are visible?', 'How many buildings are present?'],
    confidence: 91,
    answerSummary: 'Three significant structural changes were detected in the northern region.',
    evidencePoints: [
      'Detected structural changes',
      '3 detected change regions',
      'Spatial consistency check passed',
    ],
    detectedFeaturesCount: 3,
  },
  {
    id: 'change_vqa',
    name: 'Change VQA',
    category: 'compare',
    icon: MessageSquareDiff,
    prompt: 'How much agricultural land was converted into built-up structures between 2025 and 2026?',
    suggestions: ['Quantify deforestation or clearance', 'Identify newly built warehouses'],
    confidence: 89,
    answerSummary: 'Approximately 14.8 hectares of previously cultivated land transitioned into warehouse foundations and access roads.',
    evidencePoints: ['14.8 ha land-cover conversion verified', '8 new structure foundations detected', 'Bi-temporal registration error < 0.3 px'],
    detectedFeaturesCount: 8,
  },
  {
    id: 'optical_sar',
    name: 'Optical + SAR Analysis',
    category: 'fusion',
    icon: Layers,
    prompt: 'Perform all-weather radar penetration analysis fused with optical spectral signatures to identify surface moisture and metal structures.',
    suggestions: ['Show SAR backscatter anomaly', 'Identify subsurface water channels'],
    confidence: 95,
    answerSummary: 'SAR VV/VH polarization confirmed high dielectric permittivity indicative of subsurface moisture and metallic warehouse roofing.',
    evidencePoints: ['SAR backscatter cross-correlation complete', 'Cloud-penetrating radar coherence verified', 'Multimodal feature fusion aligned'],
    detectedFeaturesCount: 19,
  },
];

export const QUERY_AGENT_TOOL: AnalysisTool = {
  id: 'query_agent',
  name: 'Query Agent',
  icon: Bot,
  description: 'Autonomous natural-language satellite intelligence agent',
};

export const ANALYSIS_TOOLS: AnalysisTool[] = [
  {
    id: 'vqa',
    name: 'Single Image VQA',
    icon: MessageSquare,
    modeId: 'vqa',
  },
  {
    id: 'captioning',
    name: 'Image Captioning',
    icon: FileText,
    modeId: 'captioning',
  },
  {
    id: 'grounding',
    name: 'Object Grounding',
    icon: ScanSearch,
    modeId: 'grounding',
  },
  {
    id: 'change_analysis',
    name: 'Change Analysis',
    icon: GitCompare,
    modeId: 'change_analysis',
  },
  {
    id: 'change_vqa',
    name: 'Change VQA',
    icon: MessageSquareDiff,
    modeId: 'change_vqa',
  },
  {
    id: 'optical_sar',
    name: 'Optical + SAR Analysis',
    icon: Layers,
    modeId: 'optical_sar',
  },
];

interface WorkspaceSecondarySidebarProps {
  activeToolId?: string;
  activeModeId?: string;
  onSelectTool: (tool: AnalysisTool) => void;
  onSelectMode?: (mode: AnalysisModeConfig) => void;
  onNewAnalysis: () => void;
  onUploadImagery: () => void;
  onSavedResults: () => void;
}

export function WorkspaceSecondarySidebar({
  activeToolId,
  activeModeId,
  onSelectTool,
  onSelectMode,
  onNewAnalysis,
  onUploadImagery,
  onSavedResults,
}: WorkspaceSecondarySidebarProps) {
  const [isQueryAgentExpanded, setIsQueryAgentExpanded] = useState(true);
  const currentActiveId = activeToolId || activeModeId;
  const isQueryAgentActive = currentActiveId === 'query_agent';

  return (
    <aside className="w-56 lg:w-60 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#080d1a] flex flex-col py-3 px-2 shrink-0 select-none overflow-y-auto">
      {/* Header Pill */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 mb-3 shadow-sm">
        <span className="text-xs font-bold tracking-tight">Analysis Workspace</span>
        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
      </div>

      {/* Quick Action Links */}
      <div className="space-y-0.5 mb-3">
        <button
          onClick={onNewAnalysis}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 rounded-md transition-colors font-medium text-left"
        >
          <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
          <span>New Analysis</span>
        </button>

        <button
          onClick={onUploadImagery}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 rounded-md transition-colors font-medium text-left"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span>Upload Imagery</span>
        </button>

        <button
          onClick={onSavedResults}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 rounded-md transition-colors font-medium text-left"
        >
          <Bookmark className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span>Saved Results</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-200 dark:bg-slate-800/80 my-2 mx-1" />

      {/* Query Agent Section - Primary Analysis Workspace Entry */}
      <div className="space-y-1">
        <div
          className={cn(
            'w-full flex items-center justify-between rounded-lg transition-all duration-150',
            isQueryAgentActive
              ? 'bg-slate-200/90 dark:bg-slate-800/95 text-blue-700 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
          )}
        >
          {/* Main selection button */}
          <button
            type="button"
            onClick={() => {
              if (isQueryAgentActive) {
                // If already active, toggle expand/collapse
                setIsQueryAgentExpanded((prev) => !prev);
              } else {
                onSelectTool(QUERY_AGENT_TOOL);
                if (!isQueryAgentExpanded) {
                  setIsQueryAgentExpanded(true);
                }
              }
            }}
            className="flex items-center gap-2.5 px-2.5 py-2 flex-1 min-w-0 text-left focus:outline-none"
          >
            <div
              className={cn(
                'w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors',
                isQueryAgentActive
                  ? 'bg-blue-600/15 dark:bg-cyan-500/20 text-blue-600 dark:text-cyan-400'
                  : 'text-blue-600 dark:text-cyan-400 bg-blue-500/10 dark:bg-cyan-400/10'
              )}
            >
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold tracking-tight truncate">Query Agent</span>
          </button>

          {/* Chevron expand/collapse toggle button */}
          <button
            type="button"
            aria-expanded={isQueryAgentExpanded}
            aria-label={isQueryAgentExpanded ? 'Collapse Query Agent analysis tools' : 'Expand Query Agent analysis tools'}
            onClick={(e) => {
              e.stopPropagation();
              setIsQueryAgentExpanded((prev) => !prev);
            }}
            className="p-2 mr-1 rounded hover:bg-slate-300/40 dark:hover:bg-slate-700/40 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 focus:outline-none"
          >
            {isQueryAgentExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Nested Child Analysis Tools */}
        {isQueryAgentExpanded && (
          <div className="ml-2 pl-2 border-l border-slate-200/80 dark:border-slate-800/80 space-y-1 mt-1">
            <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              Analysis Tools
            </div>

            <div className="space-y-1">
              {ANALYSIS_TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = currentActiveId === tool.id;

                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      onSelectTool(tool);
                      if (onSelectMode && tool.modeId) {
                        const mode = WORKSPACE_MODES.find((m) => m.id === tool.modeId);
                        if (mode) onSelectMode(mode);
                      }
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-left',
                      isActive
                        ? 'bg-slate-200/90 dark:bg-slate-800/95 text-blue-700 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors',
                        isActive
                          ? 'bg-blue-600/15 dark:bg-cyan-500/20 text-blue-600 dark:text-cyan-400'
                          : 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{tool.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
