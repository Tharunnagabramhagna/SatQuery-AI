import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  variant?: 'inline' | 'card' | 'fullscreen' | 'skeleton';
  skeletonLines?: number;
  className?: string;
}

export function LoadingState({
  message = 'Loading...',
  subMessage,
  variant = 'card',
  skeletonLines = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn('inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400', className)}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" aria-hidden="true" />
        <span>{message}</span>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div
        role="status"
        aria-label={message}
        className={cn('w-full space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm', className)}
      >
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-1/3" />
        {Array.from({ length: skeletonLines }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse"
            style={{ width: `${85 - (i % 3) * 15}%` }}
          />
        ))}
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-xl',
        variant === 'card' && 'p-8 border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm',
        variant === 'fullscreen' && 'fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md',
        className
      )}
    >
      <div className="relative flex items-center justify-center mb-3">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
        <div className="absolute w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
      </div>
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-0.5">{message}</p>
      {subMessage && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">{subMessage}</p>
      )}
    </div>
  );
}
