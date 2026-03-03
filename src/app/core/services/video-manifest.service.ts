import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { DeviceClass, VideoManifestItem, VideoManifestResponse, VideoSurface } from '../models/video-manifest.model';

@Injectable({ providedIn: 'root' })
export class VideoManifestService {
  private readonly manifestCache = new Map<string, { expiresAt: number; payload: VideoManifestResponse }>();
  private readonly inFlight = new Map<string, Observable<VideoManifestResponse>>();
  private requestNonce = 0;
  private readonly fallbackItems: Array<{
    id: string;
    title: string;
    quote: string;
    durationSec: number;
    priority: number;
    active: boolean;
  }> = [
    {
      id: 'ratikanta',
      title: 'Ratikanta M.',
      quote: 'The instant EMI process entirely online changed everything. No branch visits!',
      durationSec: 24,
      priority: 10,
      active: true
    },
    {
      id: 'monica',
      title: 'Monica S.',
      quote: 'Approved in minutes and I bought my MacBook immediately. Flawless.',
      durationSec: 20,
      priority: 20,
      active: true
    },
    {
      id: 'sreekanth',
      title: 'Sreekanth P.',
      quote: 'No waiting lines! FastEMIs connected me to the best partner seamlessly.',
      durationSec: 30,
      priority: 30,
      active: true
    },
    {
      id: 'ritika',
      title: 'Ritika K.',
      quote: 'The transparent fees and instant approval saved me so much hassle.',
      durationSec: 28,
      priority: 40,
      active: true
    },
    {
      id: 'rudra',
      title: 'Rudra T.',
      quote: 'I was skeptical, but the zero hidden fees part is 100 percent real.',
      durationSec: 24,
      priority: 50,
      active: true
    },
    {
      id: 'damayanti',
      title: 'Damayanti N.',
      quote: 'Super fast approval and great customer service. Highly recommended!',
      durationSec: 24,
      priority: 60,
      active: true
    },
    {
      id: 'jayakrishna',
      title: 'Jayakrishna G.',
      quote: 'I got my mobile phone on EMI without a credit card. Amazing service.',
      durationSec: 25,
      priority: 70,
      active: true
    },
    {
      id: 'maya',
      title: 'Maya S.',
      quote: 'The whole process is paperless and very straightforward. Thank you FastEMIs.',
      durationSec: 23,
      priority: 80,
      active: true
    },
    {
      id: 'subhaprada',
      title: 'Subhaprada P.',
      quote: 'I recommend FastEMIs to my friends. Truly future-ready payments.',
      durationSec: 23,
      priority: 90,
      active: true
    }
  ];

  constructor(private http: HttpClient) { }

  getManifest(surface: VideoSurface, device: DeviceClass): Observable<VideoManifestResponse> {
    const cacheKey = `${surface}:${device}`;
    const now = Date.now();
    const cached = this.manifestCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return of(this.cloneManifest(cached.payload));
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const startedAt = performance.now();
    const params = new HttpParams()
      .set('surface', surface)
      .set('device', device)
      .set('_mv', String(this.requestNonce));

    const request$ = this.http.get<VideoManifestResponse>('/api/public/video-manifest', { params }).pipe(
      map((payload) => this.normalizeManifest(payload)),
      tap((payload) => this.setCache(cacheKey, payload, payload.cacheTtlSec)),
      tap((payload) => {
        const elapsed = Math.round(performance.now() - startedAt);
        console.info(`[video-metrics] manifest:${surface}:${device} loaded in ${elapsed}ms (items=${payload.items.length})`);
      }),
      catchError((error) => {
        const elapsed = Math.round(performance.now() - startedAt);
        console.warn(`[video-metrics] manifest:${surface}:${device} fallback after ${elapsed}ms`, error);
        const fallback = this.buildFallbackManifest(surface, device);
        this.setCache(cacheKey, fallback, 20);
        return of(this.cloneManifest(fallback));
      }),
      finalize(() => this.inFlight.delete(cacheKey)),
      shareReplay(1)
    );

    this.inFlight.set(cacheKey, request$);
    return request$;
  }

  clearManifestCache(): void {
    this.manifestCache.clear();
    this.inFlight.clear();
    this.requestNonce += 1;
  }

  private normalizeManifest(payload: VideoManifestResponse | null | undefined): VideoManifestResponse {
    const rawItems = Array.isArray(payload?.items) ? payload?.items : [];
    const items = rawItems
      .map((item) => this.normalizeItem(item))
      .filter((item) => !!item)
      .sort((a, b) => a.priority - b.priority) as VideoManifestItem[];

    return {
      version: String(payload?.version || 'v1'),
      cacheTtlSec: Number(payload?.cacheTtlSec || 300),
      items
    };
  }

  private setCache(cacheKey: string, payload: VideoManifestResponse, ttlSec: number): void {
    const safeTtl = Math.max(10, Math.min(300, Number(ttlSec || 0)));
    this.manifestCache.set(cacheKey, {
      expiresAt: Date.now() + safeTtl * 1000,
      payload: this.cloneManifest(payload)
    });
  }

  private cloneManifest(payload: VideoManifestResponse): VideoManifestResponse {
    return {
      version: payload.version,
      cacheTtlSec: payload.cacheTtlSec,
      items: payload.items.map((item) => ({ ...item }))
    };
  }

  private normalizeItem(item: VideoManifestItem | null | undefined): VideoManifestItem | null {
    if (!item) {
      return null;
    }

    const id = String(item.id || '').trim();
    const url = String(item.url || '').trim();
    if (!id || !url) {
      return null;
    }

    return {
      id,
      title: String(item.title || '').trim() || 'FastEMIs Member',
      quote: String(item.quote || '').trim(),
      url,
      posterUrl: String(item.posterUrl || '').trim(),
      durationSec: Number(item.durationSec || 0),
      priority: Number(item.priority || 0),
      active: Boolean(item.active)
    };
  }

  private buildFallbackManifest(surface: VideoSurface, device: DeviceClass): VideoManifestResponse {
    const heroIds = new Set(['ratikanta', 'monica', 'sreekanth', 'ritika', 'rudra', 'damayanti', 'jayakrishna', 'maya']);
    const items = this.fallbackItems
      .filter((item) => (surface === 'hero' ? heroIds.has(item.id) : true))
      .map((item) => ({
        ...item,
        url: `/media/video/${item.id}.v1.${device}.mp4`,
        posterUrl: `/media/video/${item.id}.v1.poster.svg`
      }));

    return {
      version: 'fallback-v1',
      cacheTtlSec: 45,
      items
    };
  }
}
