import { Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface BrandMarkProps {
  collapsed?: boolean;
  className?: string;
}

export function BrandMark({ collapsed = false, className }: BrandMarkProps) {
  return (
    <Link
      to="/dashboard"
      className={cn(
        'flex items-center gap-2.5 text-decoration-none group transition-opacity hover:opacity-90',
        className
      )}
    >
      <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-700 text-white shadow-md shadow-blue-900/30 border border-blue-400/20 group-hover:border-blue-400/40 transition-colors shrink-0">
        <Globe className="w-4 h-4 text-white" />
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping opacity-75" />
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400" />
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100 text-base">SatQuery</span>
            <span className="px-1 py-0.5 text-[10px] font-bold tracking-widest bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-500/30">AI</span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase mt-0.5">
            Space Intelligence
          </span>
        </div>
      )}
    </Link>
  );
}
