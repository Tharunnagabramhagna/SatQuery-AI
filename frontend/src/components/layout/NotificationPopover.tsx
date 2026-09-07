import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  GitCompare,
  Database,
  Activity,
  Check,
  BellOff,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'analysis' | 'result' | 'dataset' | 'system';
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Analysis completed',
    description: 'Change Analysis completed successfully.',
    time: '2 min ago',
    read: false,
    type: 'analysis',
  },
  {
    id: '2',
    title: 'New analysis result',
    description: 'New satellite imagery analysis result is ready.',
    time: '18 min ago',
    read: false,
    type: 'result',
  },
  {
    id: '3',
    title: 'Dataset update',
    description: 'Satellite imagery dataset was updated.',
    time: '1 hour ago',
    read: false,
    type: 'dataset',
  },
  {
    id: '4',
    title: 'System notification',
    description: 'SatQuery AI system is operating normally.',
    time: '3 hours ago',
    read: true,
    type: 'system',
  },
];

interface NotificationPopoverProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export function NotificationPopover({
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
  onClose: externalOnClose,
}: NotificationPopoverProps = {}) {
  const { t } = useTranslation();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Toggle dropdown
  const togglePopover = () => {
    if (isControlled) {
      externalOnToggle?.();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const closePopover = () => {
    if (isControlled) {
      externalOnClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopover();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isControlled]);

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Mark single notification as read
  const handleItemClick = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Icon selector based on notification type
  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'analysis':
        return (
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <GitCompare className="w-3.5 h-3.5" />
          </div>
        );
      case 'result':
        return (
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        );
      case 'dataset':
        return (
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Database className="w-3.5 h-3.5" />
          </div>
        );
      case 'system':
      default:
        return (
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  return (
    <div ref={popoverRef} className="relative inline-block text-left">
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={togglePopover}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          'relative p-1.5 rounded-lg transition-colors focus:outline-none',
          isOpen
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        )}
        title={t('notifications.title')}
        aria-label={t('notifications.title')}
      >
        <Bell className="w-4 h-4" />

        {/* Unread Indicator Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-cyan-400" />
          </span>
        )}
      </button>

      {/* Floating Notifications Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800/90 shadow-2xl shadow-slate-900/15 dark:shadow-cyan-950/20 z-50 overflow-hidden animate-in fade-in zoom-in-[0.98] duration-150 select-none">
          {/* Popover Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {t('notifications.title')}
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-cyan-500/15 text-blue-700 dark:text-cyan-300 border border-blue-200/50 dark:border-cyan-500/30">
                  {unreadCount} {t('notifications.newBadge')}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 transition-colors"
              >
                <Check className="w-3 h-3" />
                <span>{t('notifications.markAllRead')}</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center text-center text-slate-400">
                <BellOff className="w-8 h-8 stroke-1 text-slate-400/80 mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('notifications.noNotifications')}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('notifications.allCaughtUp')}
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={cn(
                    'flex items-start gap-3 p-3 transition-colors cursor-pointer text-left',
                    item.read
                      ? 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40 opacity-80'
                      : 'bg-blue-50/40 dark:bg-cyan-950/10 hover:bg-blue-50/70 dark:hover:bg-cyan-950/25'
                  )}
                >
                  {renderIcon(item.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={cn(
                          'text-xs font-semibold truncate',
                          item.read
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-900 dark:text-slate-100 font-bold'
                        )}
                      >
                        {t(`notifications.item${item.id}Title`) || item.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {item.time}
                      </span>
                    </div>

                    <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                      {t(`notifications.item${item.id}Desc`) || item.description}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!item.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Popover Footer */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{t('notifications.eventStreamActive')}</span>
            </span>
            <button
              type="button"
              onClick={() => setNotifications([])}
              className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {t('notifications.clearAll')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
