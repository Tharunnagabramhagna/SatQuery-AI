import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface BrandMarkProps {
  collapsed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
  linkTo?: string;
  tagline?: string;
}

export function BrandMark({
  collapsed = false,
  className,
  size = 'md',
  showSubtitle = true,
  linkTo = '/dashboard',
  tagline,
}: BrandMarkProps) {
  const isHero = size === 'hero' || size === 'lg';
  const isSm = size === 'sm';

  const logoSizeClass = isHero
    ? 'w-24 h-24 sm:w-28 sm:h-28' // visible logo ~80px - 93px (within 72-112px target)
    : isSm
    ? 'w-8 h-8'
    : 'w-[40px] h-[40px]'; // visible logo ~33.5px (within 32-38px target)

  const innerContent = (
    <div
      className={cn(
        'flex items-center group transition-opacity hover:opacity-95',
        isHero ? 'flex-col text-center gap-4' : 'gap-2.5',
        className
      )}
    >
      {/* Official SatQuery AI Logo Mark with Real Transparency */}
      <div
        className={cn(
          'relative shrink-0 aspect-square flex items-center justify-center transition-transform group-hover:scale-[1.02]',
          logoSizeClass
        )}
      >
        <img
          src="/assets/satquery-logo.png"
          alt="SatQuery AI"
          className="w-full h-full object-contain select-none"
          loading="eager"
        />
      </div>

      {!collapsed && (
        <div className={cn('flex flex-col justify-center', isHero ? 'items-center' : 'items-start text-left')}>
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                'font-bold tracking-tight text-slate-900 dark:text-slate-100',
                isHero ? 'text-2xl sm:text-3xl' : 'text-[15px] leading-tight'
              )}
            >
              SatQuery
            </span>
            <span
              className={cn(
                'font-bold tracking-wider bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-cyan-400 rounded border border-blue-200 dark:border-blue-500/30 leading-none',
                isHero ? 'px-2 py-0.5 text-xs' : 'px-1 py-0.5 text-[10px]'
              )}
            >
              AI
            </span>
          </div>

          {showSubtitle && !isHero && (
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase mt-0.5 leading-tight">
              Space Intelligence
            </span>
          )}

          {isHero && (
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md mt-2 font-medium">
              {tagline || 'From Complex Imagery to Clear Intelligence.'}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="inline-flex items-center text-decoration-none focus:outline-none">
        {innerContent}
      </Link>
    );
  }

  return innerContent;
}
