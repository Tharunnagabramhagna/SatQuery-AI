import { Sparkles, Play, ShieldAlert, Satellite, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';

interface DashboardHeroProps {
  onLaunchDemo: () => void;
}

export function DashboardHero({ onLaunchDemo }: DashboardHeroProps) {
  const navigate = useNavigate();

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-gradient-to-b from-blue-50/70 via-slate-50/50 to-white dark:from-[#0e1628] dark:via-[#0a0f1e] dark:to-[#070b14] p-6 sm:p-8 lg:p-10 shadow-lg dark:shadow-xl mb-8 geo-grid-pattern transition-colors duration-150">
      {/* Subtle Aerospace Ambient Accent */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 rounded-full bg-blue-400/10 dark:bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-cyan-400/10 dark:bg-cyan-600/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl">
        {/* Category Label */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold tracking-wide mb-5">
          <Satellite className="w-3.5 h-3.5" />
          <span>SIH26167 · Space Technology · Multimodal Remote Sensing</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-4 leading-[1.15]">
          Ask Your Satellite Imagery <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-500 dark:from-blue-400 dark:via-cyan-300 dark:to-blue-200 bg-clip-text text-transparent">Anything.</span>
        </h1>

        {/* Supporting Description */}
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-6 leading-relaxed max-w-3xl">
          Analyze complex remote-sensing and Earth-observation imagery through natural-language queries,
          intelligent agent routing, and evidence-backed geospatial reasoning.
        </p>

        {/* Call to Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant="primary"
            icon={<Sparkles className="w-4 h-4 text-cyan-200" />}
            onClick={() => navigate('/analysis')}
            className="shadow-lg shadow-blue-600/20 px-6 font-semibold"
          >
            Start New Analysis
          </Button>

          <Button
            size="lg"
            variant="secondary"
            icon={<Play className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
            onClick={onLaunchDemo}
            className="px-6 font-medium"
          >
            Launch Demo
          </Button>
        </div>

        {/* Subtle Feature highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Multi-Sensor Optical & SAR</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Satellite className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>Bi-Temporal Change Detection</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Evidence-Backed Verification</span>
          </div>
        </div>
      </div>
    </div>
  );
}
