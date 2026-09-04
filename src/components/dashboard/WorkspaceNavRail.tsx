import { Sparkles, UploadCloud, History, Bookmark, LogOut } from 'lucide-react';
import { cn } from '../../utils/cn';

interface WorkspaceNavRailProps {
  onNewAnalysis: () => void;
  onUploadImagery: () => void;
  onRecentAnalyses: () => void;
  onSavedResults: () => void;
  activeItem?: string;
}

export function WorkspaceNavRail({
  onNewAnalysis,
  onUploadImagery,
  onRecentAnalyses,
  onSavedResults,
  activeItem = 'new',
}: WorkspaceNavRailProps) {
  const items = [
    {
      id: 'new',
      label: 'New Analysis',
      icon: Sparkles,
      onClick: onNewAnalysis,
    },
    {
      id: 'upload',
      label: 'Upload Imagery',
      icon: UploadCloud,
      onClick: onUploadImagery,
    },
    {
      id: 'recent',
      label: 'Recent Analyses',
      icon: History,
      onClick: onRecentAnalyses,
    },
    {
      id: 'saved',
      label: 'Saved Results',
      icon: Bookmark,
      onClick: onSavedResults,
    },
  ];

  return (
    <aside className="w-[72px] border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#070b15] flex flex-col items-center justify-between py-3 shrink-0 select-none z-20">
      <div className="flex flex-col items-center gap-3 w-full px-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                'group relative w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all duration-150',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-500/30 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )}
              title={item.label}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium leading-tight mt-1 text-center text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Exit / Collapse icon */}
      <div className="w-full px-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex justify-center">
        <button
          onClick={onRecentAnalyses}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          title="Return to Analyses"
          aria-label="Exit workspace"
        >
          <LogOut className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </aside>
  );
}
