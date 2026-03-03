export type DeviceClass = 'mobile' | 'desktop';
export type VideoSurface = 'hero' | 'testimonials';

export interface VideoManifestItem {
  id: string;
  title: string;
  quote: string;
  url: string;
  posterUrl: string;
  durationSec: number;
  priority: number;
  active: boolean;
}

export interface VideoManifestResponse {
  version: string;
  cacheTtlSec: number;
  items: VideoManifestItem[];
}
