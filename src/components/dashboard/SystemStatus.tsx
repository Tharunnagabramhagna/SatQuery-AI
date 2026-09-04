import { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, HardDrive, Network, RefreshCw } from 'lucide-react';
import { getSystemStatus } from '../../services/api';
import type { SystemStatus as SystemStatusType } from '../../types';
import { Badge } from '../common/Badge';

export function SystemStatus() {
  const [status, setStatus] = useState<SystemStatusType | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = () => {
    setRefreshing(true);
    getSystemStatus().then((data) => {
      setStatus(data);
      setRefreshing(false);
    });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/60 p-6 transition-colors duration-150">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">System Architecture Status</h2>
          <Badge variant="demo" className="text-[9px]">DEMO</Badge>
        </div>
        <button
          onClick={fetchStatus}
          disabled={refreshing}
          className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Core VLM Routing */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-transparent">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Model Router</div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Vision-Language</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 mt-0.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Ready (Mock)</span>
            </div>
          </div>
        </div>

        {/* Multi-Sensor Ingestion */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-transparent">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sensor Ingestion</div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">GeoTIFF / SAR</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 mt-0.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Active</span>
            </div>
          </div>
        </div>

        {/* Agent Orchestration */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-transparent">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Agent Pipeline</div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Trace Engine</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 mt-0.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Operational</span>
            </div>
          </div>
        </div>

        {/* Evidence Verification */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-transparent">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Evidence Validator</div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Grounding / Mask</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 mt-0.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Calibrated</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/60 pt-3">
        <span>Environment: <span className="font-mono text-slate-700 dark:text-slate-300">Demo Prototype (SIH26167)</span></span>
        <span>Last Ping: <span className="font-mono text-slate-700 dark:text-slate-300">{status ? new Date(status.lastChecked).toLocaleTimeString() : '...'}</span></span>
      </div>
    </div>
  );
}
