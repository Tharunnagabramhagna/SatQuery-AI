import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  LayoutDashboard,
  ScanSearch,
  GitCompare,
  Layers,
  Image as ImageIcon,
  History,
  Database,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderBookmark,
  ActivitySquare
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { cn } from '../../utils/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavSection {
  title?: string;
  items: {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    isAction?: boolean;
    onClick?: () => void;
  }[];
}

export function Sidebar({ collapsed, onToggle, isMobile, onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewAnalysis = () => {
    navigate('/analysis');
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const sections: NavSection[] = [
    {
      items: [
        {
          label: 'Dashboard',
          path: '/dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        {
          label: 'Current Analysis',
          path: '/analysis',
          icon: ActivitySquare,
        },
        {
          label: 'Recent Analyses',
          path: '/history',
          icon: History,
        },
        {
          label: 'Saved Results',
          path: '/history?filter=saved',
          icon: FolderBookmark,
        },
      ],
    },
    {
      title: 'CAPABILITIES',
      items: [
        {
          label: 'Single Image VQA',
          path: '/analysis?mode=single_image&cap=vqa',
          icon: ImageIcon,
        },
        {
          label: 'Object Grounding',
          path: '/analysis?mode=single_image&cap=grounding',
          icon: ScanSearch,
        },
        {
          label: 'Change Analysis',
          path: '/analysis?mode=compare_images&cap=change_detection',
          icon: GitCompare,
        },
        {
          label: 'Optical + SAR',
          path: '/analysis?mode=optical_sar&cap=multimodal_analysis',
          icon: Layers,
        },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        {
          label: 'Datasets',
          path: '/datasets',
          icon: Database,
        },
        {
          label: 'Documentation',
          path: '/documentation',
          icon: BookOpen,
        },
        {
          label: 'Settings',
          path: '/settings',
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-slate-50/75 dark:bg-[#080d1a]/55 backdrop-blur-xl backdrop-saturate-150 border-r border-slate-200/60 dark:border-white/[0.06] transition-all duration-300 ease-in-out select-none z-40 shrink-0',
        collapsed ? 'w-[68px]' : 'w-64',
        isMobile ? 'w-64 h-full' : 'h-screen sticky top-0 hidden lg:flex'
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200/60 dark:border-white/[0.06]">
        <BrandMark collapsed={collapsed} />
        {!isMobile && (
          <button
            onClick={onToggle}
            className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Primary CTA: New Analysis */}
      <div className="p-3">
        <button
          onClick={handleNewAnalysis}
          className={cn(
            'w-full flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150',
            'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-[0_10px_28px_rgba(14,165,233,0.22)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            collapsed ? 'p-2.5' : 'py-2 px-3 text-xs'
          )}
          title={collapsed ? 'Start New Analysis' : undefined}
        >
          <Sparkles className="w-4 h-4 text-cyan-200 shrink-0" />
          {!collapsed && <span className="font-semibold tracking-wide">New Analysis</span>}
        </button>
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-4">
        {sections.map((section, secIdx) => (
          <div key={secIdx} className="space-y-1">
            {section.title && !collapsed && (
              <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path.split('?')[0] && (
                !item.path.includes('?') || location.search === `?${item.path.split('?')[1]}`
              );

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={isMobile ? onCloseMobile : undefined}
                  className={({ isActive: defaultActive }) => {
                    const active = item.path.includes('?') ? isActive : defaultActive;
                    return cn(
                      'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                      active
                        ? 'bg-blue-500/[0.08] text-blue-600 border border-blue-400/20 dark:bg-cyan-400/[0.07] dark:text-cyan-300 dark:border-cyan-400/20 backdrop-blur-md font-semibold shadow-[0_4px_18px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/50',
                      collapsed && 'justify-center px-2'
                    );
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}

                  {/* Tooltip on collapse hover */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-slate-100 text-[11px] rounded-md shadow-xl border border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer Info */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-200/60 dark:border-white/[0.06] bg-white/20 dark:bg-white/[0.025] backdrop-blur-lg">
          <div className="flex flex-col gap-0.5 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-300">
              <span className="font-semibold">SIH 2026</span>
              <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-mono">SIH26167</span>
            </div>
            <p className="text-[10px] text-slate-500 truncate">Team Stark Visions</p>
          </div>
        </div>
      )}
    </aside>
  );
}
