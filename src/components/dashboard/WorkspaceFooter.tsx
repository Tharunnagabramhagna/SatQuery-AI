import { Atom } from 'lucide-react';

export function WorkspaceFooter() {
  return (
    <footer className="w-full h-9 px-4 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#070b15] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 select-none shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-medium">
          <Atom className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '10s' }} />
          <span>React, TypeScript, Tailwind CSS</span>
        </div>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="hidden sm:inline text-amber-600/90 dark:text-amber-400/90 font-medium">
          Demo Mode — Sample imagery and simulated analysis
        </span>
      </div>

      <div className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
        SIH26167 · Tailored for 1440px desktop display
      </div>
    </footer>
  );
}
