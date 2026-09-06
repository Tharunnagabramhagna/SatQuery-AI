import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Compass,
  Network,
  Bot,
  Layers,
  ScanSearch,
  GitCompare,
  Binary,
  Activity,
  ShieldCheck,
  FileSpreadsheet,
  Code2,
  Milestone,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Info,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Menu,
  X,
} from 'lucide-react';
import { getDocumentationSections } from '../services/api';
import type { DocumentationSection, DocumentationCallout } from '../types';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { cn } from '../utils/cn';

// Icon resolver for Lucide icons stored in section models
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Compass,
  Network,
  Bot,
  Layers,
  ScanSearch,
  GitCompare,
  Binary,
  Activity,
  ShieldCheck,
  FileSpreadsheet,
  Code2,
  Milestone,
  AlertTriangle,
};

// Category metadata
const CATEGORIES: { id: DocumentationSection['category']; label: string }[] = [
  { id: 'core', label: 'Core System' },
  { id: 'agent', label: 'Agent & Capabilities' },
  { id: 'workspace', label: 'Visual Workspaces' },
  { id: 'intelligence', label: 'Intelligence & Output' },
  { id: 'engineering', label: 'Engineering & Roadmap' },
];

export function DocumentationPage() {
  const [sections, setSections] = useState<DocumentationSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Load sections from API service
  useEffect(() => {
    let isMounted = true;
    getDocumentationSections()
      .then((data) => {
        if (isMounted) {
          setSections(data);
          setIsLoading(false);

          // Check for URL hash on initial load
          const hash = window.location.hash.replace('#', '');
          if (hash && data.some((s) => s.id === hash)) {
            setActiveSectionId(hash);
          } else if (data.length > 0) {
            setActiveSectionId(data[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load documentation sections:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync state with URL hash and listen for browser Back/Forward (hashchange)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && sections.some((s) => s.id === hash)) {
        setActiveSectionId(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [sections]);

  // Navigate to a section and update the URL hash
  const handleSelectSection = useCallback((id: string) => {
    setActiveSectionId(id);
    window.location.hash = id;
    setIsMobileNavOpen(false);

    // Scroll to top of content area on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Search filtering logic: checks title, description, content, and subsections
  const searchFilteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;

    const q = searchQuery.toLowerCase();
    return sections.filter((sec) => {
      const matchTitle = sec.title.toLowerCase().includes(q);
      const matchDesc = sec.shortDescription.toLowerCase().includes(q);
      const matchContent = sec.content.some((c) => c.toLowerCase().includes(q));
      const matchSubsections = sec.subsections?.some(
        (sub) =>
          sub.title.toLowerCase().includes(q) ||
          sub.content.some((sc) => sc.toLowerCase().includes(q))
      );
      return matchTitle || matchDesc || matchContent || matchSubsections;
    });
  }, [sections, searchQuery]);

  const activeSection = useMemo(() => {
    return sections.find((s) => s.id === activeSectionId) || sections[0];
  }, [sections, activeSectionId]);

  // Sequential previous/next navigation
  const currentIndex = useMemo(() => {
    return sections.findIndex((s) => s.id === activeSection?.id);
  }, [sections, activeSection]);

  const prevSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const nextSection = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

  const renderCallout = (callout: DocumentationCallout) => {
    const configs = {
      note: {
        icon: Info,
        border: 'border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300',
        iconColor: 'text-blue-500',
        label: 'NOTE',
      },
      tip: {
        icon: Lightbulb,
        border: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
        iconColor: 'text-emerald-500',
        label: 'TIP',
      },
      warning: {
        icon: AlertCircle,
        border: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
        iconColor: 'text-amber-500',
        label: 'WARNING',
      },
      info: {
        icon: HelpCircle,
        border: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300',
        iconColor: 'text-cyan-500',
        label: 'INFORMATION',
      },
    };

    const config = configs[callout.type] || configs.info;
    const Icon = config.icon;

    return (
      <div className={cn('flex items-start gap-3 p-3.5 rounded-xl border my-4', config.border)}>
        <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', config.iconColor)} aria-hidden="true" />
        <div className="flex-1 text-xs leading-relaxed">
          <span className="font-bold tracking-wider mr-1.5 uppercase text-[10px]">
            [{config.label}]
          </span>
          {callout.text}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 space-y-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-cyan-500" aria-hidden="true" />
              Technical Documentation Center
            </h1>
            <span
              title="SatQuery AI Technical Documentation. Features and workflows describe the demonstration platform."
              className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-help"
            >
              DEMO
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Explore how SatQuery AI turns natural-language questions into evidence-backed satellite intelligence.
          </p>
        </div>

        {/* Mobile Navigation Toggle Button */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            icon={isMobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          >
            {isMobileNavOpen ? 'Close Menu' : 'Browse Topics'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState
          message="Loading technical documentation..."
          subMessage="Fetching architecture specs and remote-sensing workflow guides"
          variant="card"
          className="py-20"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* ─── Left Sidebar Navigation ────────────────────────── */}
          <aside
            className={cn(
              'md:col-span-4 lg:col-span-3 space-y-4 md:sticky md:top-20 z-10',
              isMobileNavOpen ? 'block' : 'hidden md:block'
            )}
          >
            {/* Search Filter Input */}
            <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  aria-label="Search documentation topics"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <span>
                    {searchFilteredSections.length} {searchFilteredSections.length === 1 ? 'match' : 'matches'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Categorized Section Navigation */}
            <nav
              role="tablist"
              aria-label="Documentation sections"
              className="bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm max-h-[75vh] overflow-y-auto space-y-4"
            >
              {CATEGORIES.map((category) => {
                const categorySections = searchFilteredSections.filter(
                  (s) => s.category === category.id
                );

                if (categorySections.length === 0 && searchQuery) {
                  return null;
                }

                return (
                  <div key={category.id} className="space-y-1">
                    <h3 className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {category.label}
                    </h3>

                    <div className="space-y-0.5">
                      {categorySections.map((sec) => {
                        const IconComponent = SECTION_ICONS[sec.icon] || BookOpen;
                        const isActive = sec.id === activeSection?.id;

                        return (
                          <button
                            key={sec.id}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => handleSelectSection(sec.id)}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-all',
                              isActive
                                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shadow-sm font-semibold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <IconComponent className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-cyan-500' : 'text-slate-400')} />
                              <span className="truncate">{sec.title}</span>
                            </div>
                            {sec.isPlanned && (
                              <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0 ml-1">
                                PLANNED
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {searchFilteredSections.length === 0 && (
                <div className="py-6 px-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  No matching topics found for "{searchQuery}".
                </div>
              )}
            </nav>
          </aside>

          {/* ─── Right Content Area ─────────────────────────────── */}
          <main className="md:col-span-8 lg:col-span-9">
            {activeSection ? (
              <article className="bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
                {/* Section Header */}
                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {CATEGORIES.find((c) => c.id === activeSection.category)?.label}
                    </span>
                    {activeSection.isDemo && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        DEMO CALIBRATED
                      </span>
                    )}
                    {activeSection.isPlanned && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        PLANNED INTEGRATION
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                    {activeSection.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {activeSection.shortDescription}
                  </p>
                </div>

                {/* Visual Flow Diagram (if present) */}
                {activeSection.flowDiagram && activeSection.flowDiagram.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-3">
                      Visual Pipeline Workflow
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {activeSection.flowDiagram.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                            <span className="w-4 h-4 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-[10px] font-bold font-mono">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {step}
                            </span>
                          </div>
                          {idx < activeSection.flowDiagram!.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" aria-hidden="true" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary Content Paragraphs */}
                <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeSection.content.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>

                {/* Subsections */}
                {activeSection.subsections && activeSection.subsections.length > 0 && (
                  <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                    {activeSection.subsections.map((sub) => (
                      <div key={sub.id} className="space-y-3">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          {sub.title}
                        </h3>

                        <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {sub.content.map((sc, scIdx) => (
                            <p key={scIdx}>{sc}</p>
                          ))}
                        </div>

                        {/* Code Block if present */}
                        {sub.codeBlock && (
                          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#070b15] shadow-inner my-3">
                            <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400">
                              <span>{sub.codeBlock.language.toUpperCase()}</span>
                              <span>ARCHITECTURE SPECIFICATION</span>
                            </div>
                            <pre className="p-3.5 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                              <code>{sub.codeBlock.code}</code>
                            </pre>
                          </div>
                        )}

                        {/* Callout Box if present */}
                        {sub.callout && renderCallout(sub.callout)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Previous / Next Bounded Navigation Bar */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                  {prevSection ? (
                    <button
                      type="button"
                      onClick={() => handleSelectSection(prevSection.id)}
                      className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block">Previous</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 truncate max-w-[160px] block">
                          {prevSection.title}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div />
                  )}

                  {nextSection ? (
                    <button
                      type="button"
                      onClick={() => handleSelectSection(nextSection.id)}
                      className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Next</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 truncate max-w-[160px] block">
                          {nextSection.title}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </article>
            ) : (
              <EmptyState
                icon={Search}
                title="No matching documentation section"
                description={
                  searchQuery
                    ? `No documentation topics match "${searchQuery}". Try a different keyword.`
                    : 'Select a documentation topic from the navigation sidebar.'
                }
                actionLabel="Clear Search"
                onAction={() => setSearchQuery('')}
                className="py-20"
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
