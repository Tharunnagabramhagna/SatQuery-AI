import { LucideIcon } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { useNavigate } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  statusLabel?: string;
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  statusLabel = 'Coming Soon',
}: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {description}
        </p>
      </div>

      <EmptyState
        icon={Icon}
        title={`${title} Module`}
        description={`This module is ${statusLabel}. The foundational architecture has been scaffolded.`}
        actionLabel="Go to Dashboard"
        onAction={() => navigate('/dashboard')}
        className="py-16 shadow-sm"
      />
    </div>
  );
}
