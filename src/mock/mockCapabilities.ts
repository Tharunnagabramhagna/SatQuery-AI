import type { ModeInfo, CapabilityInfo } from '../types';

export const MODES: ModeInfo[] = [
  {
    id: 'single_image',
    name: 'Single Image',
    description: 'Analyze a single satellite or remote-sensing image using AI-powered visual understanding.',
    icon: 'Image',
    capabilities: ['vqa', 'captioning', 'grounding'],
  },
  {
    id: 'compare_images',
    name: 'Compare Images',
    description: 'Detect and analyze changes between two temporal images of the same region.',
    icon: 'Images',
    capabilities: ['change_detection', 'change_vqa', 'change_localization'],
  },
  {
    id: 'optical_sar',
    name: 'Optical + SAR',
    description: 'Analyze complementary information across optical and SAR sensing modalities.',
    icon: 'Layers',
    capabilities: ['multimodal_analysis'],
  },
];

export const CAPABILITIES: CapabilityInfo[] = [
  {
    id: 'vqa',
    name: 'Visual Question Answering',
    description: 'Ask questions about satellite imagery and receive AI-generated answers.',
    icon: 'MessageSquareText',
    mode: 'single_image',
  },
  {
    id: 'captioning',
    name: 'Image Captioning',
    description: 'Generate descriptive interpretations of satellite imagery.',
    icon: 'FileText',
    mode: 'single_image',
  },
  {
    id: 'grounding',
    name: 'Object Grounding',
    description: 'Locate and identify queried objects or regions within satellite imagery.',
    icon: 'ScanSearch',
    mode: 'single_image',
  },
  {
    id: 'change_detection',
    name: 'Change Detection',
    description: 'Identify and map differences between bi-temporal satellite imagery.',
    icon: 'GitCompareArrows',
    mode: 'compare_images',
  },
  {
    id: 'change_vqa',
    name: 'Change VQA',
    description: 'Ask natural-language questions about observed changes between images.',
    icon: 'MessageSquareDiff',
    mode: 'compare_images',
  },
  {
    id: 'change_localization',
    name: 'Change Localization',
    description: 'Pinpoint specific regions where significant changes have occurred.',
    icon: 'MapPin',
    mode: 'compare_images',
  },
  {
    id: 'multimodal_analysis',
    name: 'Multimodal Analysis',
    description: 'Analyze complementary information from optical and SAR imagery together.',
    icon: 'Combine',
    mode: 'optical_sar',
  },
];

export const CAPABILITY_MAP: Record<string, CapabilityInfo> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c])
);

export const MODE_MAP: Record<string, ModeInfo> = Object.fromEntries(
  MODES.map((m) => [m.id, m])
);
