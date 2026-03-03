import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DeviceClass, VideoManifestItem } from '../../../../core/models/video-manifest.model';
import { VideoManifestService } from '../../../../core/services/video-manifest.service';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  styles: [`
    .hero-shell {
      background:
        radial-gradient(1200px 600px at 0% -10%, rgba(29, 161, 242, 0.08), transparent 60%),
        linear-gradient(180deg, #f7f9fc 0%, #f4f7fb 100%);
    }

    .hero-story-card {
      border-radius: 2rem;
      overflow: hidden;
      border: 1px solid rgba(16, 36, 66, 0.12);
      background: rgba(255, 255, 255, 0.8);
      box-shadow:
        0 28px 60px -20px rgba(10, 37, 64, 0.32),
        0 12px 30px -10px rgba(10, 37, 64, 0.2);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .hero-video-wrap {
      position: relative;
      background: #081a2b;
      min-height: 18rem;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
    }

    .hero-video-overlay {
      background: linear-gradient(to top, rgba(2, 14, 28, 0.92) 0%, rgba(2, 14, 28, 0.52) 42%, rgba(2, 14, 28, 0.05) 100%);
    }

    .hero-loader-bar {
      background: linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.4), rgba(255,255,255,0.14));
      background-size: 220px 100%;
      animation: shimmer 1.2s linear infinite;
    }

    @keyframes shimmer {
      0% { background-position: -220px 0; }
      100% { background-position: 220px 0; }
    }
  `],
  template: `
    <section class="hero-shell pt-24 pb-12 md:pt-32 md:pb-20 relative overflow-hidden">
      <div class="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E6EDF7" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
          <path d="M0 80 Q 200 150 400 50 T 800 100 T 1200 40" fill="none" stroke="#D9E5F3" stroke-width="2" />
          <path d="M0 120 Q 250 180 450 80 T 900 130 T 1200 60" fill="none" stroke="#EEF3FA" stroke-width="4" />
        </svg>
      </div>

      <div class="container relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-16">
        <div class="flex-1 flex flex-col items-center text-center md:items-start md:text-left fade-in">
          <h1 class="font-display text-4xl md:text-5xl lg:text-6xl text-primary leading-tight mb-4 tracking-tight">
            Finance Your Goals.<br/>
            No Branch Visits.<br/>
            <span class="text-accent relative inline-block">
              No Waiting Lines.
              <svg class="absolute w-full h-3 -bottom-1 left-0 text-accent opacity-30" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 2" stroke="currentColor" stroke-width="4" fill="none" />
              </svg>
            </span>
          </h1>

          <p class="text-secondary text-base md:text-lg max-w-lg mb-8">
            Compare the world's trusted EMI partners, apply in minutes, and get your purchase financed &mdash; entirely online.
          </p>

          <div class="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-8">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 border border-border rounded-full text-xs font-medium text-primary shadow-sm">
              <span>🔒</span> Globally Regulated
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 border border-border rounded-full text-xs font-medium text-primary shadow-sm">
              <span>⚡</span> Instant Processing
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 border border-border rounded-full text-xs font-medium text-primary shadow-sm hidden sm:flex">
              <span>🛡️</span> 256-bit Secure
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 border border-border rounded-full text-xs font-medium text-primary shadow-sm hidden lg:flex">
              <span>✅</span> Licensed Institution
            </span>
          </div>

          <app-button variant="primary" [fullWidth]="false" class="w-full md:w-auto shadow-md" (onClick)="scrollToPartners()">
            Explore Finance Partners &rarr;
          </app-button>
        </div>

        <div class="flex-1 w-full max-w-sm md:max-w-md">
          <div class="hero-story-card">
            <div class="px-4 md:px-5 py-3 border-b border-white/60 bg-white/70 flex items-center justify-between gap-3">
              <div class="text-xs font-semibold text-primary/90 tracking-wide uppercase">Customer Stories</div>
              <div class="text-[11px] text-secondary font-medium">
                {{ activeIndex() + 1 }} / {{ videos().length || 1 }}
              </div>
            </div>

            <div
              #storyViewport
              class="hero-video-wrap"
              (touchstart)="onTouchStart($event)"
              (touchend)="onTouchEnd($event)">

              <div *ngIf="loading()" class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#081a2b] text-white">
                <div class="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                <div class="text-sm font-semibold">Loading fast stories...</div>
              </div>

              <ng-container *ngIf="!loading() && activeVideo() as current">
                <img
                  *ngIf="showPosterOverlay()"
                  [src]="current.posterUrl || fallbackPoster"
                  alt="Story poster"
                  class="absolute inset-0 z-10 w-full h-full object-cover" />

                <video
                  #activeVideo
                  class="w-full h-[23rem] md:h-[32rem] object-cover"
                  [src]="current.url"
                  [poster]="current.posterUrl || fallbackPoster"
                  [muted]="isMuted()"
                  preload="metadata"
                  playsinline
                  [autoplay]="isPlaying()"
                  (loadeddata)="onVideoLoaded()"
                  (ended)="onVideoEnded()"
                  (error)="onVideoError($event)">
                </video>

                <div class="hero-video-overlay absolute inset-0 z-20 pointer-events-none"></div>

                <div class="absolute inset-x-0 bottom-0 z-30 p-4 md:p-5 text-white">
                  <div class="text-lg md:text-xl font-semibold leading-tight">{{ current.title }}</div>
                  <div class="text-[11px] uppercase tracking-widest text-white/75 mt-1">Verified Customer</div>
                  <p class="mt-2 text-sm md:text-base text-white/95 leading-relaxed">"{{ current.quote }}"</p>
                </div>

                <div *ngIf="autoplayBlocked()" class="absolute inset-0 z-40 flex items-center justify-center bg-black/35">
                  <button
                    type="button"
                    (click)="resumeWithGesture()"
                    class="h-14 px-6 rounded-full bg-white/95 text-primary font-semibold shadow-xl border border-white/60">
                    Tap To Play
                  </button>
                </div>

                <button
                  type="button"
                  (click)="togglePlay()"
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full bg-black/45 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm shadow-xl">
                  <svg *ngIf="!isPlaying()" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="ml-0.5"><path d="M8 5.5v13l10-6.5z"></path></svg>
                  <svg *ngIf="isPlaying()" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="4" height="14" rx="1"></rect><rect x="13" y="5" width="4" height="14" rx="1"></rect></svg>
                </button>

                <div class="absolute right-3 top-3 z-40 flex flex-col gap-2">
                  <button
                    type="button"
                    (click)="toggleAudio()"
                    class="w-10 h-10 rounded-full bg-black/45 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm">
                    <svg *ngIf="isMuted()" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                    <svg *ngIf="!isMuted()" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  </button>
                </div>

                <div class="absolute right-3 bottom-5 z-40 flex flex-col gap-2">
                  <button
                    type="button"
                    (click)="prev()"
                    class="w-10 h-10 rounded-full bg-black/45 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm"
                    aria-label="Previous story">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  </button>
                  <button
                    type="button"
                    (click)="next(false, 'button')"
                    class="w-10 h-10 rounded-full bg-black/45 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm"
                    aria-label="Next story">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                </div>

                <div class="absolute inset-x-0 top-0 z-40 px-4 pt-3">
                  <div class="h-1.5 w-full rounded-full bg-white/25 overflow-hidden">
                    <div class="hero-loader-bar h-full transition-all duration-300" [style.width.%]="loadingProgress()"></div>
                  </div>
                </div>
              </ng-container>

              <div *ngIf="!loading() && !videos().length" class="absolute inset-0 z-20 flex items-center justify-center text-sm text-white/90 bg-[#081a2b]">
                No videos available right now.
              </div>
            </div>

            <div class="px-4 py-3 text-xs text-secondary bg-white/80 border-t border-white/60 flex items-center justify-between">
              <span>{{ isMobile() ? 'Swipe left/right for next story' : 'Use controls for next story' }}</span>
              <span>Manifest: {{ manifestVersion() || '-' }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class HomeHeroComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('activeVideo') activeVideoRef?: ElementRef<HTMLVideoElement>;

  readonly videos = signal<VideoManifestItem[]>([]);
  readonly loading = signal<boolean>(true);
  readonly activeIndex = signal<number>(0);
  readonly isMuted = signal<boolean>(true);
  readonly isPlaying = signal<boolean>(true);
  readonly autoplayBlocked = signal<boolean>(false);
  readonly waitingForFirstFrame = signal<boolean>(true);
  readonly firstFrameReady = signal<boolean>(false);
  readonly isMobile = signal<boolean>(false);
  readonly manifestVersion = signal<string>('');

  readonly fallbackPoster =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230a2540"/><stop offset="100%" stop-color="%231e4e7a"/></linearGradient></defs><rect width="720" height="1280" fill="url(%23g)"/><text x="52" y="110" fill="white" font-family="Arial" font-size="52" font-weight="700">FastEMIs Story</text><text x="52" y="1190" fill="%239ec9ea" font-family="Arial" font-size="26">Tap to Play</text></svg>';

  readonly activeVideo = computed(() => {
    const list = this.videos();
    if (!list.length) {
      return null;
    }
    const index = this.activeIndex();
    return list[index] || list[0] || null;
  });

  private readonly autoRotateMs = 9000;
  private autoRotateTimer: number | null = null;
  private prefetchVideo: HTMLVideoElement | null = null;
  private heroStartAt = 0;
  private firstFrameLogged = false;
  private autoplayRejectCount = 0;
  private videoErrorCount = 0;
  private browserReady = false;
  private touchStartX = 0;
  private touchStartY = 0;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private manifestService: VideoManifestService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.browserReady = isPlatformBrowser(this.platformId);
    if (!this.browserReady) {
      this.loading.set(false);
      return;
    }

    this.updateDeviceState();
    this.fetchManifest();
  }

  ngAfterViewInit(): void {
    if (!this.browserReady) {
      return;
    }
    window.setTimeout(() => this.tryPlayActive('view_init'), 120);
  }

  ngOnDestroy(): void {
    this.clearAutoRotate();
    this.activeVideoRef?.nativeElement.pause();
    if (this.prefetchVideo) {
      this.prefetchVideo.src = '';
      this.prefetchVideo.load();
      this.prefetchVideo = null;
    }
  }

  @HostListener('window:visibilitychange')
  onVisibilityChange(): void {
    if (!this.browserReady) {
      return;
    }

    if (document.hidden) {
      this.clearAutoRotate();
      this.activeVideoRef?.nativeElement.pause();
      return;
    }

    this.startAutoRotate();
    this.tryPlayActive('visibility_resume');
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasMobile = this.isMobile();
    this.updateDeviceState();
    if (wasMobile !== this.isMobile()) {
      this.fetchManifest();
    }
  }

  scrollToPartners(): void {
    const el = document.getElementById('partnersList');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  showPosterOverlay(): boolean {
    return this.waitingForFirstFrame() || this.autoplayBlocked();
  }

  loadingProgress(): number {
    const listLength = this.videos().length || 1;
    return Math.max(12, Math.min(100, ((this.activeIndex() + 1) / listLength) * 100));
  }

  onVideoLoaded(): void {
    this.waitingForFirstFrame.set(false);
    this.firstFrameReady.set(true);

    if (!this.firstFrameLogged) {
      this.firstFrameLogged = true;
      const firstFrameMs = Math.round(performance.now() - this.heroStartAt);
      console.info(`[video-metrics] hero:first-frame in ${firstFrameMs}ms`);
    }

    this.tryPlayActive('loadeddata');
    this.preloadNextVideoMetadata();
  }

  onVideoEnded(): void {
    this.next(true);
  }

  onVideoError(event: Event): void {
    this.videoErrorCount += 1;
    this.waitingForFirstFrame.set(false);
    this.autoplayBlocked.set(true);
    this.isPlaying.set(false);
    console.warn('[video-metrics] hero:video-error', {
      errorCount: this.videoErrorCount,
      activeId: this.activeVideo()?.id,
      event
    });
  }

  resumeWithGesture(): void {
    this.autoplayBlocked.set(false);
    this.isPlaying.set(true);
    this.tryPlayActive('gesture_resume', true);
  }

  togglePlay(): void {
    const video = this.activeVideoRef?.nativeElement;
    if (!video) {
      return;
    }

    if (this.isPlaying()) {
      this.isPlaying.set(false);
      video.pause();
      this.clearAutoRotate();
      return;
    }

    this.isPlaying.set(true);
    this.autoplayBlocked.set(false);
    this.tryPlayActive('toggle_play', true);
    this.startAutoRotate();
  }

  toggleAudio(): void {
    this.isMuted.update((value) => !value);
    const video = this.activeVideoRef?.nativeElement;
    if (video) {
      video.muted = this.isMuted();
      if (!video.paused) {
        this.tryPlayActive('audio_toggle', true);
      }
    }
  }

  prev(): void {
    this.setActiveIndex(this.activeIndex() - 1, 'manual_prev');
  }

  next(fromAuto = false, trigger: 'button' | 'swipe' | 'other' = 'other'): void {
    const total = this.videos().length;
    const atLastStory = total > 0 && this.activeIndex() === total - 1;
    if (!fromAuto && trigger === 'button' && atLastStory) {
      this.clearAutoRotate();
      this.activeVideoRef?.nativeElement.pause();
      this.router.navigateByUrl('/testimonials-all');
      return;
    }

    this.setActiveIndex(this.activeIndex() + 1, fromAuto ? 'auto_next' : 'manual_next');
  }

  onTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      this.next(false, 'swipe');
    } else {
      this.prev();
    }
  }

  private fetchManifest(): void {
    const device: DeviceClass = this.isMobile() ? 'mobile' : 'desktop';
    this.loading.set(true);
    this.waitingForFirstFrame.set(true);
    this.firstFrameReady.set(false);
    this.autoplayBlocked.set(false);
    this.heroStartAt = performance.now();
    this.firstFrameLogged = false;

    this.manifestService.getManifest('hero', device).subscribe((payload) => {
      const items = payload.items.filter((item) => item.active && !!item.url);
      this.videos.set(items);
      this.manifestVersion.set(payload.version || 'v1');
      this.loading.set(false);
      this.activeIndex.set(0);

      if (!items.length) {
        this.clearAutoRotate();
        return;
      }

      this.startAutoRotate();
      window.setTimeout(() => {
        this.tryPlayActive('manifest_loaded');
        this.preloadNextVideoMetadata();
      }, 80);
    });
  }

  private setActiveIndex(nextIndex: number, reason: string): void {
    const total = this.videos().length;
    if (!total) {
      return;
    }

    const normalized = ((nextIndex % total) + total) % total;
    this.activeIndex.set(normalized);
    this.waitingForFirstFrame.set(true);
    this.autoplayBlocked.set(false);

    console.info('[video-metrics] hero:index-change', {
      reason,
      index: normalized,
      videoId: this.videos()[normalized]?.id
    });

    window.setTimeout(() => {
      this.tryPlayActive('index_change');
      this.preloadNextVideoMetadata();
    }, 20);

    this.startAutoRotate();
  }

  private tryPlayActive(reason: string, fromGesture = false): void {
    if (!this.browserReady || !this.videos().length) {
      return;
    }

    const video = this.activeVideoRef?.nativeElement;
    if (!video) {
      return;
    }

    video.muted = this.isMuted();

    if (!this.isPlaying()) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (!playPromise || typeof playPromise.then !== 'function') {
      return;
    }

    playPromise.catch((error) => {
      this.autoplayRejectCount += 1;
      this.autoplayBlocked.set(true);
      if (!fromGesture) {
        this.isPlaying.set(false);
      }
      console.warn('[video-metrics] hero:autoplay-rejected', {
        reason,
        rejects: this.autoplayRejectCount,
        activeId: this.activeVideo()?.id,
        error
      });
    });
  }

  private preloadNextVideoMetadata(): void {
    const list = this.videos();
    if (list.length < 2 || !this.browserReady) {
      return;
    }

    const next = list[(this.activeIndex() + 1) % list.length];
    if (!next?.url) {
      return;
    }

    if (!this.prefetchVideo) {
      this.prefetchVideo = document.createElement('video');
      this.prefetchVideo.preload = 'metadata';
      this.prefetchVideo.muted = true;
      this.prefetchVideo.playsInline = true;
    }

    if (this.prefetchVideo.src !== next.url) {
      this.prefetchVideo.src = next.url;
      this.prefetchVideo.load();
    }
  }

  private startAutoRotate(): void {
    this.clearAutoRotate();
    if (!this.browserReady || this.videos().length < 2) {
      return;
    }

    this.autoRotateTimer = window.setInterval(() => {
      if (!document.hidden && this.isPlaying() && !this.autoplayBlocked()) {
        this.next(true);
      }
    }, this.autoRotateMs);
  }

  private clearAutoRotate(): void {
    if (this.autoRotateTimer !== null) {
      window.clearInterval(this.autoRotateTimer);
      this.autoRotateTimer = null;
    }
  }

  private updateDeviceState(): void {
    if (!this.browserReady) {
      this.isMobile.set(false);
      return;
    }
    this.isMobile.set(window.innerWidth < 768);
  }
}
