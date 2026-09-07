import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ArrowUpRight, Search, Filter } from 'lucide-react';
import { getRecentAnalyses } from '../../services/api';
import type { AnalysisRecord } from '../../types';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';

export function RecentAnalyses() {
  const { t } = useTranslation();
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    getRecentAnalyses().then((data) => {
      if (isMounted) {
        setAnalyses(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAnalyses = analyses.filter((item) =>
    item.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.capability.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.modality.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getCapabilityLabel = (cap: string) => {
    const labels: Record<string, string> = {
      vqa: 'Visual QA',
      captioning: 'Captioning',
      grounding: 'Grounding',
      change_detection: 'Change Detection',
      change_vqa: 'Change VQA',
      change_localization: 'Change Localization',
      multimodal_analysis: 'Optical+SAR',
    };
    return labels[cap] || cap;
  };

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/60 p-6 mb-8 transition-colors duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{t('recentAnalyses.title')}</h2>
            <Badge variant="demo" className="text-[9px]">{t('recentAnalyses.demoBadge')}</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('recentAnalyses.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={t('recentAnalyses.filterPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors w-48 sm:w-64"
            />
          </div>
          <button
            onClick={() => navigate('/history')}
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 text-xs transition-colors"
            title={t('recentAnalyses.viewAllHistory')}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
          {t('recentAnalyses.loadingAnalyses')}
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('recentAnalyses.noAnalysesTitle')}
          description={t('recentAnalyses.noAnalysesDesc')}
          actionLabel={t('recentAnalyses.startAnalysis')}
          onAction={() => navigate('/analysis')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/80 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{t('recentAnalyses.tableType')}</th>
                <th className="py-3 px-4">{t('recentAnalyses.tableQuery')}</th>
                <th className="py-3 px-4">{t('recentAnalyses.tableModality')}</th>
                <th className="py-3 px-4">{t('recentAnalyses.tableDate')}</th>
                <th className="py-3 px-4">{t('recentAnalyses.tableStatus')}</th>
                <th className="py-3 px-4 text-right">{t('recentAnalyses.tableAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredAnalyses.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/analysis?demoId=${item.id}`)}
                >
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-blue-600 dark:text-blue-400 text-xs font-semibold">
                      {getCapabilityLabel(item.capability)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-200 max-w-md truncate">
                    {item.query}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                    {item.modality}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                    {formatDate(item.date)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="capitalize text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                        {item.status === 'completed' ? t('history.completed') : item.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      className="p-1 rounded text-slate-400 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={t('recentAnalyses.inspectAnalysis')}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/analysis?demoId=${item.id}`);
                      }}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
