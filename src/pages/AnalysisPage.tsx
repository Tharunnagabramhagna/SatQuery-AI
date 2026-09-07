import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, RefreshCw } from 'lucide-react';
import { useAnalysis } from '../hooks/useAnalysis';
import { AnalysisStepper } from '../components/analysis/AnalysisStepper';
import { AnalysisModeSelector } from '../components/analysis/AnalysisModeSelector';
import { CapabilitySelector } from '../components/analysis/CapabilitySelector';
import { DynamicUploadArea } from '../components/analysis/DynamicUploadArea';
import { QueryInterface } from '../components/analysis/QueryInterface';
import { AnalysisResultPlaceholder } from '../components/analysis/AnalysisResultPlaceholder';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import type { AnalysisMode, AnalysisCapability } from '../types';

export function AnalysisPage() {
  const [searchParams] = useSearchParams();
  const {
    state,
    setMode,
    setCapability,
    setQuery,
    uploadImage,
    removeImage,
    submitForAnalysis,
    loadDemo,
    reset,
    goToStep,
  } = useAnalysis();

  // Read URL search params for deep linking or demo launching
  useEffect(() => {
    const isDemo = searchParams.get('demo');
    const demoId = searchParams.get('demoId');
    const modeParam = searchParams.get('mode') as AnalysisMode | null;
    const capParam = searchParams.get('cap') as AnalysisCapability | null;

    if (isDemo === 'true') {
      loadDemo();
    } else if (demoId) {
      if (demoId.includes('003') || demoId.includes('change')) {
        loadDemo('demo-change');
      } else if (demoId.includes('004') || demoId.includes('optical')) {
        loadDemo('demo-optical-sar');
      } else if (demoId.includes('001') || demoId.includes('grounding')) {
        loadDemo('demo-grounding');
      } else {
        loadDemo('demo-vqa');
      }
    } else if (modeParam) {
      setMode(modeParam);
      if (capParam) {
        setCapability(capParam);
      }
    }
  }, [searchParams, loadDemo, setMode, setCapability]);

  const getFieldError = (field: string) => {
    return state.errors.find((e) => e.field === field)?.message;
  };

  return (
    <div className="w-full space-y-6">
      {/* Header with Title and Quick Demo Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Interactive Analysis Workspace
            </h1>
            {state.isDemo && (
              <Badge variant="demo" className="text-[10px]">DEMO SCENARIO</Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Formulate text queries across single-image, bi-temporal, or optical-SAR sensing modalities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!state.isDemo && state.status !== 'completed' && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Play className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
              onClick={() => loadDemo()}
            >
              Load Demo Scenario
            </Button>
          )}

          {(state.mode || state.query || Object.keys(state.images).length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={reset}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Stepper Indicator */}
      <AnalysisStepper
        currentStep={state.currentStep}
        onStepClick={goToStep}
      />

      {/* Main Workflow Area */}
      {state.status === 'completed' && state.response ? (
        <AnalysisResultPlaceholder
          response={state.response}
          onReset={reset}
        />
      ) : (
        <div className="space-y-6">
          {/* STEP 1: Mode Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-300">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Select Imagery Sensor Mode</span>
            </div>

            <AnalysisModeSelector
              selectedMode={state.mode}
              onSelectMode={setMode}
              disabled={state.status === 'analyzing'}
            />
          </section>

          {/* STEP 2: Capability Selection (Dynamic based on mode) */}
          {state.mode && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Select Target Analytical Capability</span>
              </div>

              <CapabilitySelector
                mode={state.mode}
                selectedCapability={state.capability}
                onSelectCapability={setCapability}
                error={getFieldError('capability')}
                disabled={state.status === 'analyzing'}
              />
            </section>
          )}

          {/* STEP 3: Image Upload Area (Dynamic slots based on mode) */}
          {state.mode && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Upload Remote-Sensing Imagery</span>
              </div>

              <DynamicUploadArea
                mode={state.mode}
                images={state.images}
                onUpload={uploadImage}
                onRemove={removeImage}
                errors={state.errors}
                disabled={state.status === 'analyzing'}
              />
            </section>
          )}

          {/* STEP 4: Natural-Language Query Box */}
          {state.mode && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>Natural-Language Query & Reasoning Command</span>
              </div>

              <QueryInterface
                query={state.query}
                onQueryChange={setQuery}
                onAnalyze={submitForAnalysis}
                status={state.status}
                mode={state.mode}
                error={getFieldError('query')}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
