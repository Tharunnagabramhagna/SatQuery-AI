import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'default' | 'compact' | 'card';
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0a0f1e]/40',
        isCompact ? 'p-4' : 'p-8',
        variant === 'card' && 'bg-white dark:bg-slate-900/60 shadow-sm',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shadow-sm transition-transform duration-300 motion-safe:hover:scale-105',
          isCompact ? 'w-9 h-9 mb-2' : 'w-12 h-12 mb-3'
        )}
      >
        <Icon className={cn(isCompact ? 'w-4 h-4' : 'w-6 h-6')} aria-hidden="true" />
      </div>
      <h3
        className={cn(
          'font-semibold text-slate-800 dark:text-slate-200 mb-1',
          isCompact ? 'text-xs' : 'text-sm'
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'text-slate-500 dark:text-slate-400 max-w-sm',
          isCompact ? 'text-[11px] mb-2' : 'text-xs mb-4'
        )}
      >
        {description}
      </p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2 mt-1">
          {actionLabel && onAction && (
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="ghost" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
