import { LucideIcon, Database, BookOpen, Settings, History } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { useNavigate } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  phase?: string;
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  phase = 'Phase 2',
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
        description={`This module is scheduled for implementation in ${phase}. The foundational architecture has been scaffolded.`}
        actionLabel="Go to Dashboard"
        onAction={() => navigate('/dashboard')}
        className="py-16 shadow-sm"
      />
    </div>
  );
}

export function HistoryPage() {
  return (
    <PlaceholderPage
      title="Analysis History & Saved Results"
      description="Browse historical reasoning executions, spatial masks, and comparative reports."
      icon={History}
      phase="Phase 2"
    />
  );
}

export function DatasetsPage() {
  return (
    <PlaceholderPage
      title="Satellite Datasets & Pre-Loaded Scenarios"
      description="Access public benchmark collections: RSIVQA, WHU-CD, LEVIR-CD, and Sentinel/NISAR testbeds."
      icon={Database}
      phase="Phase 2"
    />
  );
}

export function DocumentationPage() {
  return (
    <PlaceholderPage
      title="System Architecture & API Documentation"
      description="Technical specifications for VLM model routing, GIS preprocessing, and evidence grounding pipelines."
      icon={BookOpen}
      phase="Phase 2"
    />
  );
}

export function SettingsPage() {
  return (
    <PlaceholderPage
      title="Platform Settings & API Configurations"
      description="Configure remote sensing endpoints, raster tiling parameters, and model inference tokens."
      icon={Settings}
      phase="Phase 2"
    />
  );
}
