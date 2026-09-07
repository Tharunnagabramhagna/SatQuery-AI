import { useNavigate } from 'react-router-dom';
import {
  MessageSquareText,
  FileText,
  ScanSearch,
  GitCompare,
  MessageSquareDiff,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { useTranslation } from '../../hooks/useTranslation';

interface CapabilityItem {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  mode: string;
  capability: string;
  badge?: string;
}

const CAPABILITY_LIST: CapabilityItem[] = [
  {
    id: 'vqa',
    title: 'Single Image VQA',
    category: 'Optical / Multispectral',
    description: 'Ask complex natural-language questions about objects, terrain, infrastructure, and conditions in satellite imagery.',
    icon: MessageSquareText,
    mode: 'single_image',
    capability: 'vqa',
  },
  {
    id: 'captioning',
    title: 'Scene Captioning',
    category: 'Scene Interpretation',
    description: 'Generate comprehensive natural-language descriptions of land-use, land-cover, and structural features.',
    icon: FileText,
    mode: 'single_image',
    capability: 'captioning',
  },
  {
    id: 'grounding',
    title: 'Object Grounding',
    category: 'Spatial Localization',
    description: 'Locate queried objects, roads, buildings, or water bodies with precise spatial boundary references.',
    icon: ScanSearch,
    mode: 'single_image',
    capability: 'grounding',
  },
  {
    id: 'change_detection',
    title: 'Change Detection',
    category: 'Bi-Temporal Analysis',
    description: 'Identify, classify, and quantify changes between satellite images captured across different dates.',
    icon: GitCompare,
    mode: 'compare_images',
    capability: 'change_detection',
  },
  {
    id: 'change_vqa',
    title: 'Change VQA',
    category: 'Temporal Reasoning',
    description: 'Query specific differences, urban expansions, deforestation, or disaster impacts between temporal pairs.',
    icon: MessageSquareDiff,
    mode: 'compare_images',
    capability: 'change_vqa',
  },
  {
    id: 'optical_sar',
    title: 'Optical + SAR Analysis',
    category: 'Multimodal Fusion',
    description: 'Leverage all-weather SAR penetration alongside optical spectral fidelity for complementary structural insights.',
    icon: Layers,
    mode: 'optical_sar',
    capability: 'multimodal_analysis',
    badge: 'FUSION',
  },
];

export function CapabilitiesGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSelectCapability = (mode: string, cap: string) => {
    navigate(`/analysis?mode=${mode}&cap=${cap}`);
  };

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">{t('capabilities.title')}</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('capabilities.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CAPABILITY_LIST.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => handleSelectCapability(item.mode, item.capability)}
              className="group relative flex flex-col justify-between p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/60 hover:bg-slate-50/70 dark:hover:bg-[#0f1628] hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-600/20 transition-colors shadow-inner">
                    <Icon className="w-5 h-5" />
                  </div>
                  {item.badge ? (
                    <Badge variant="info" className="text-[10px]">{item.badge}</Badge>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{item.category}</span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2 flex items-center gap-1.5">
                  {item.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/60">
                <span>{t('capabilities.startAnalysis')}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
