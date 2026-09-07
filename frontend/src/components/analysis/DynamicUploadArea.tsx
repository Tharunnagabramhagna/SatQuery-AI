import type { AnalysisMode, UploadedImage, ValidationError } from '../../types';
import { ImageUpload } from './ImageUpload';

interface DynamicUploadAreaProps {
  mode: AnalysisMode | null;
  images: Record<string, UploadedImage | null>;
  onUpload: (slotId: string, file: File) => void;
  onRemove: (slotId: string) => void;
  errors: ValidationError[];
  disabled?: boolean;
}

export function DynamicUploadArea({
  mode,
  images,
  onUpload,
  onRemove,
  errors,
  disabled = false,
}: DynamicUploadAreaProps) {
  const getErrorForField = (field: string) => {
    return errors.find((e) => e.field === field)?.message;
  };

  if (!mode || mode === 'single_image') {
    return (
      <div className="w-full">
        <ImageUpload
          label="Satellite Imagery Input"
          sublabel="Upload single-date optical or multispectral satellite imagery"
          modalityBadge="SINGLE SCENE"
          image={images['primary']}
          onUpload={(file) => onUpload('primary', file)}
          onRemove={() => onRemove('primary')}
          error={getErrorForField('image')}
          disabled={disabled}
        />
      </div>
    );
  }

  if (mode === 'compare_images') {
    return (
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload
          label="Previous / Before Imagery (T1)"
          sublabel="Upload baseline historical satellite imagery"
          modalityBadge="TEMPORAL T1"
          image={images['before']}
          onUpload={(file) => onUpload('before', file)}
          onRemove={() => onRemove('before')}
          error={getErrorForField('image_before')}
          disabled={disabled}
        />

        <ImageUpload
          label="Current / After Imagery (T2)"
          sublabel="Upload current or post-event satellite imagery"
          modalityBadge="TEMPORAL T2"
          image={images['after']}
          onUpload={(file) => onUpload('after', file)}
          onRemove={() => onRemove('after')}
          error={getErrorForField('image_after')}
          disabled={disabled}
        />
      </div>
    );
  }

  if (mode === 'optical_sar') {
    return (
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload
          label="Optical Imagery"
          sublabel="Visible / Multispectral bands (Sentinel-2, Landsat, Planet)"
          modalityBadge="OPTICAL"
          image={images['optical']}
          onUpload={(file) => onUpload('optical', file)}
          onRemove={() => onRemove('optical')}
          error={getErrorForField('image_optical')}
          disabled={disabled}
        />

        <ImageUpload
          label="SAR Imagery (Synthetic Aperture Radar)"
          sublabel="Backscatter intensity / Polarimetric radar (Sentinel-1, NISAR)"
          modalityBadge="SAR RADAR"
          image={images['sar']}
          onUpload={(file) => onUpload('sar', file)}
          onRemove={() => onRemove('sar')}
          error={getErrorForField('image_sar')}
          disabled={disabled}
        />
      </div>
    );
  }

  return null;
}
