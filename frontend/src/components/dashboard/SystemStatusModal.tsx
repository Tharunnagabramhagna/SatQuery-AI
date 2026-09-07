import { createPortal } from 'react-dom';
import { X, ShieldCheck, Cpu, HardDrive, Network } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemStatusModal({ isOpen, onClose }: SystemStatusModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0a0f1e] border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('modals.statusTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('systemStatusSection.modelRouter')}</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t('modals.visionLanguageVlm')}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">● {t('modals.readyMockCalibrated')}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-600/20 text-cyan-600 dark:text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('systemStatusSection.sensorIngestion')}</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t('modals.geoTiffSarOptical')}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">● {t('modals.activeGsd')}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('systemStatusSection.agentPipeline')}</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t('modals.executionTraceEngine')}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">● {t('modals.latency')}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('systemStatusSection.evidenceValidator')}</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t('modals.groundingMaskFilter')}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">● {t('modals.highIouCalibrated')}</div>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-xs text-slate-700 dark:text-slate-300">
          <div className="font-semibold text-blue-700 dark:text-cyan-400 mb-0.5">{t('modals.architecturePipeline')}</div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {t('modals.architectureDesc')}
          </p>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{t('modals.envLabel')}</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
