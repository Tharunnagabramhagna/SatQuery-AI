import { useState, useEffect } from 'react';
import { ShieldCheck, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ConfidenceScore } from '../../types/visualization';
import { useTranslation } from '../../hooks/useTranslation';

interface ConfidenceDisplayProps {
  score: ConfidenceScore;
  compact?: boolean;
  className?: string;
}

export function ConfidenceDisplay({ score, compact = false, className }: ConfidenceDisplayProps) {
  const { t } = useTranslation();
  const [displayValue, setDisplayValue] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(score.overall);
      return;
    }

    const duration = 600;
    const startTime = performance.now();
    const startValue = 0;
    const targetValue = score.overall;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (targetValue - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score.overall]);

  const getConfidenceLevel = (val: number) => {
    if (val >= 85) return { label: t('confidenceDisplay.high'), color: 'text-emerald-500 dark:text-emerald-400', stroke: '#10b981' };
    if (val >= 70) return { label: t('confidenceDisplay.moderate'), color: 'text-amber-500 dark:text-amber-400', stroke: '#f59e0b' };
    return { label: t('confidenceDisplay.low'), color: 'text-rose-500 dark:text-rose-400', stroke: '#f43f5e' };
  };

  const level = getConfidenceLevel(score.overall);

  // SVG Circular Gauge calculation
  const radius = compact ? 20 : 36;
  const strokeWidth = compact ? 3.5 : 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * displayValue) / 100;

  if (compact) {
    return (
      <div className={cn('mb-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800', className)}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            {/* Mini circular ring */}
            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r={radius}
                  className="stroke-slate-200 dark:stroke-slate-800 fill-none"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx="24"
                  cy="24"
                  r={radius}
                  className="fill-none transition-all duration-300 ease-out"
                  stroke={level.stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <ShieldCheck className={cn('w-3.5 h-3.5 absolute', level.color)} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                <span>{score.label}</span>
                <span className="font-mono text-[13px]">{displayValue}%</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                <span>{level.label} {t('confidenceDisplay.agreement')}</span>
                <span>•</span>
                <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">{t('common.demo')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded transition-colors"
            title="Toggle confidence breakdown"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Expandable Breakdown in compact mode */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5 animate-in fade-in duration-150">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              {t('confidenceDisplay.dimensions')}
            </div>
            {score.breakdown.map((dim) => (
              <div key={dim.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-600 dark:text-slate-400 flex-1 truncate">{dim.label}</span>
                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                    style={{ width: `${dim.value}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 w-7 text-right shrink-0">
                  {dim.value}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full display mode
  return (
    <div className={cn('p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{score.label}</span>
        </div>
        <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          {t('confidenceDisplay.demoScore')}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        {/* SVG Radial Gauge */}
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 88 88">
            <circle
              cx="44"
              cy="44"
              r={radius}
              className="stroke-slate-200 dark:stroke-slate-800 fill-none"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="44"
              cy="44"
              r={radius}
              className="fill-none transition-all duration-500 ease-out"
              stroke={level.stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 leading-none">
              {displayValue}%
            </span>
            <span className={cn('text-[10px] font-medium font-sans mt-0.5', level.color)}>
              {level.label}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
            {t('confidenceDisplay.multimodalDesc')}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            <Info className="w-3 h-3 shrink-0" />
            <span>{t('confidenceDisplay.disclaimer')}</span>
          </div>
        </div>
      </div>

      {/* Breakdown Bars */}
      <div className="space-y-2 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t('confidenceDisplay.dimensions')}
        </div>
        {score.breakdown.map((dim) => (
          <div key={dim.id} className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-700 dark:text-slate-300 font-medium">{dim.label}</span>
              <span className="font-mono text-slate-500 dark:text-slate-400">{dim.value}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${dim.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
