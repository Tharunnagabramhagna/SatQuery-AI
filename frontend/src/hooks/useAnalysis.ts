import { useState, useCallback, useMemo } from 'react';
import type {
  AnalysisMode,
  AnalysisCapability,
  AnalysisStep,
  AnalysisWorkflowState,
  UploadedImage,
  ValidationError,
} from '../types';
import { MODES } from '../mock/mockCapabilities';
import { submitAnalysis } from '../services/api';
import { DEMO_SCENARIOS } from '../mock/mockResponses';

const ACCEPTED_FORMATS = ['.tiff', '.tif', '.geotiff', '.png', '.jpg', '.jpeg'];

function createInitialState(): AnalysisWorkflowState {
  return {
    currentStep: 1,
    mode: null,
    capability: null,
    query: '',
    images: {},
    status: 'idle',
    errors: [],
    isDemo: false,
    response: null,
  };
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisWorkflowState>(createInitialState);

  // ─── Image Slots ─────────────────────────────────────────────

  const imageSlots = useMemo(() => {
    switch (state.mode) {
      case 'compare_images':
        return ['before', 'after'];
      case 'optical_sar':
        return ['optical', 'sar'];
      case 'single_image':
      default:
        return ['primary'];
    }
  }, [state.mode]);

  // ─── Mode Selection ──────────────────────────────────────────

  const setMode = useCallback((mode: AnalysisMode) => {
    setState((prev) => ({
      ...prev,
      mode,
      capability: null,
      images: {},
      errors: prev.errors.filter((e) => e.field === 'query'),
      currentStep: Math.max(prev.currentStep, 2) as AnalysisStep,
    }));
  }, []);

  // ─── Capability Selection ────────────────────────────────────

  const setCapability = useCallback((capability: AnalysisCapability) => {
    setState((prev) => ({
      ...prev,
      capability,
      errors: prev.errors.filter((e) => e.field !== 'capability'),
      currentStep: Math.max(prev.currentStep, 3) as AnalysisStep,
    }));
  }, []);

  // ─── Query ───────────────────────────────────────────────────

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({
      ...prev,
      query,
      errors: prev.errors.filter((e) => e.field !== 'query'),
    }));
  }, []);

  // ─── Image Upload ────────────────────────────────────────────

  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.includes(ext)) {
      return `File format "${ext}" is not supported. Accepted formats: ${ACCEPTED_FORMATS.join(', ')}`;
    }
    if (file.size > 100 * 1024 * 1024) {
      return 'File size exceeds the 100MB limit.';
    }
    return null;
  }, []);

  const uploadImage = useCallback(
    (slotId: string, file: File) => {
      const error = validateFile(file);
      if (error) {
        const img: UploadedImage = {
          id: `${slotId}-${Date.now()}`,
          file,
          previewUrl: '',
          status: 'error',
          progress: 0,
          metadata: null,
          error,
        };
        setState((prev) => ({
          ...prev,
          images: { ...prev.images, [slotId]: img },
        }));
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      const img: UploadedImage = {
        id: `${slotId}-${Date.now()}`,
        file,
        previewUrl,
        status: 'uploading',
        progress: 0,
        metadata: null,
        error: null,
      };

      setState((prev) => ({
        ...prev,
        images: { ...prev.images, [slotId]: img },
        errors: prev.errors.filter((e) => !e.field.startsWith('image')),
      }));

      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30 + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setState((prev) => {
            const currentImg = prev.images[slotId];
            if (!currentImg || currentImg.id !== img.id) return prev;
            return {
              ...prev,
              images: {
                ...prev.images,
                [slotId]: {
                  ...currentImg,
                  status: 'uploaded',
                  progress: 100,
                  metadata: {
                    filename: file.name,
                    fileSize: file.size,
                    dimensions: null,
                    format: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
                    sensor: null,
                    acquisitionDate: null,
                    crs: null,
                    resolution: null,
                    bands: null,
                    bounds: null,
                    isDemo: false,
                  },
                },
              },
            };
          });
        } else {
          setState((prev) => {
            const currentImg = prev.images[slotId];
            if (!currentImg || currentImg.id !== img.id) return prev;
            return {
              ...prev,
              images: {
                ...prev.images,
                [slotId]: { ...currentImg, progress: Math.min(progress, 99) },
              },
            };
          });
        }
      }, 200);
    },
    [validateFile]
  );

  const removeImage = useCallback((slotId: string) => {
    setState((prev) => {
      const img = prev.images[slotId];
      if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
      const newImages = { ...prev.images };
      delete newImages[slotId];
      return { ...prev, images: newImages };
    });
  }, []);

  // ─── Validation ──────────────────────────────────────────────

  const validate = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!state.mode) {
      return errors; // User hasn't started — no aggressive errors
    }

    // Check images based on mode
    if (state.mode === 'single_image') {
      const img = state.images['primary'];
      if (!img || img.status !== 'uploaded') {
        errors.push({ field: 'image', message: 'Please upload an image before starting analysis.' });
      }
    } else if (state.mode === 'compare_images') {
      const before = state.images['before'];
      const after = state.images['after'];
      if (!before || before.status !== 'uploaded') {
        errors.push({ field: 'image_before', message: 'Please upload the "Before" image.' });
      }
      if (!after || after.status !== 'uploaded') {
        errors.push({ field: 'image_after', message: 'Change analysis requires two images. Please upload the "After" image.' });
      }
    } else if (state.mode === 'optical_sar') {
      const optical = state.images['optical'];
      const sar = state.images['sar'];
      if (!optical || optical.status !== 'uploaded') {
        errors.push({ field: 'image_optical', message: 'Please upload the Optical image.' });
      }
      if (!sar || sar.status !== 'uploaded') {
        errors.push({ field: 'image_sar', message: 'Please upload the SAR image.' });
      }
    }

    if (!state.capability) {
      errors.push({ field: 'capability', message: 'Please select an analysis capability.' });
    }

    if (!state.query.trim()) {
      errors.push({ field: 'query', message: 'Please enter a question about the imagery.' });
    }

    return errors;
  }, [state]);

  // ─── Submit ──────────────────────────────────────────────────

  const submitForAnalysis = useCallback(async () => {
    const errors = validate();
    if (errors.length > 0) {
      setState((prev) => ({ ...prev, errors }));
      return;
    }

    setState((prev) => ({
      ...prev,
      status: 'analyzing',
      errors: [],
      currentStep: 4,
      response: null,
    }));

    try {
      const files = Object.values(state.images)
        .filter((img): img is UploadedImage => img !== null && img.status === 'uploaded')
        .map((img) => img.file);

      const response = await submitAnalysis({
        query: state.query,
        mode: state.mode!,
        capability: state.capability!,
        files,
      });

      setState((prev) => ({
        ...prev,
        status: 'completed',
        currentStep: 5,
        response,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errors: [{ field: 'query', message: 'Analysis service is currently unavailable. Please try again.' }],
      }));
    }
  }, [state, validate]);

  // ─── Demo ────────────────────────────────────────────────────

  const loadDemo = useCallback((scenarioId?: string) => {
    const scenario = scenarioId
      ? DEMO_SCENARIOS.find((s) => s.id === scenarioId)
      : DEMO_SCENARIOS[0];

    if (!scenario) return;

    const modeInfo = MODES.find((m) => m.id === scenario.mode);
    if (!modeInfo) return;

    // Build image slots based on mode
    const images: Record<string, UploadedImage> = {};
    const slotIds =
      scenario.mode === 'compare_images'
        ? ['before', 'after']
        : scenario.mode === 'optical_sar'
        ? ['optical', 'sar']
        : ['primary'];

    slotIds.forEach((slotId, i) => {
      const label = scenario.imageLabels[i] || `Demo Image ${i + 1}`;
      const dummyFile = new File([''], `${label.toLowerCase().replace(/\s+/g, '_')}_demo.tiff`, {
        type: 'image/tiff',
      });
      images[slotId] = {
        id: `demo-${slotId}-${Date.now()}`,
        file: dummyFile,
        previewUrl: '',
        status: 'uploaded',
        progress: 100,
        metadata: {
          filename: `${label.toLowerCase().replace(/\s+/g, '_')}_demo.tiff`,
          fileSize: 15728640,
          dimensions: { width: 1024, height: 1024 },
          format: 'GeoTIFF',
          sensor: 'Sentinel-2 MSI',
          acquisitionDate: '2026-03-15T10:30:00Z',
          crs: 'EPSG:4326',
          resolution: '10m',
          bands: 13,
          bounds: '77.5°E, 12.9°N — 77.7°E, 13.1°N',
          isDemo: true,
        },
        error: null,
      };
    });

    setState({
      currentStep: 3,
      mode: scenario.mode,
      capability: scenario.capability,
      query: scenario.query,
      images,
      status: 'idle',
      errors: [],
      isDemo: true,
      response: null,
    });
  }, []);

  // ─── Reset ───────────────────────────────────────────────────

  const reset = useCallback(() => {
    // Clean up preview URLs
    Object.values(state.images).forEach((img) => {
      if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setState(createInitialState());
  }, [state.images]);

  // ─── Step Navigation ─────────────────────────────────────────

  const goToStep = useCallback((step: AnalysisStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  return {
    state,
    imageSlots,
    setMode,
    setCapability,
    setQuery,
    uploadImage,
    removeImage,
    validate,
    submitForAnalysis,
    loadDemo,
    reset,
    goToStep,
  };
}
