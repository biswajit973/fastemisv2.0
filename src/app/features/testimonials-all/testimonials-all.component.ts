import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { DeviceClass, VideoManifestItem } from '../../core/models/video-manifest.model';
import { VideoManifestService } from '../../core/services/video-manifest.service';

@Component({
  selector: 'app-testimonials-all',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>

    <section class="min-h-screen bg-surface-2 pt-24 pb-12 px-4 md:px-8 relative overflow-hidden">
      <div class="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl"></div>
      <div class="pointer-events-none absolute top-32 -left-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl"></div>

      <div class="max-w-7xl mx-auto w-full relative z-10">
        <header class="text-center mb-8 md:mb-10 mt-3 md:mt-5">
          <h1 class="text-3xl md:text-5xl font-display font-extrabold text-primary leading-tight tracking-tight">
            Real Customer Video Testimonials
          </h1>
          <p class="text-secondary mt-4 max-w-3xl mx-auto text-base md:text-lg font-medium leading-relaxed">
            Once you receive your product and feel satisfied, share your feedback video and get
            <span class="text-accent font-bold">₹1,000 off</span> on your pending balance.
          </p>
        </header>

        <div class="mb-6 md:mb-8 flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs md:text-sm text-secondary bg-surface px-3 py-2 rounded-full border border-border">
            Smooth Mode: one active video playing at a time
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="scrollPrev()"
              class="w-11 h-11 rounded-full border border-border bg-surface text-primary shadow-sm flex items-center justify-center hover:bg-surface-3 transition-colors"
              aria-label="Previous Video">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button
              type="button"
              (click)="scrollNext()"
              class="w-11 h-11 rounded-full border border-border bg-surface text-primary shadow-sm flex items-center justify-center hover:bg-surface-3 transition-colors"
              aria-label="Next Video">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>

        <div
          #scrollContainer
          class="overflow-x-auto no-scrollbar pb-5"
          (scroll)="onScroll()">

          <div *ngIf="loading()" class="h-[360px] md:h-[460px] rounded-3xl border border-border bg-surface flex flex-col items-center justify-center gap-3">
            <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div class="text-primary font-semibold">Loading testimonials...</div>
          </div>

          <div *ngIf="!loading()" class="flex gap-4 md:gap-6 min-w-max px-1 md:px-2">
            <article
              #cardEl
              *ngFor="let item of videos(); let i = index; trackBy: trackByVideo"
              class="relative flex-none w-[250px] sm:w-[290px] md:w-[320px] rounded-[1.8rem] overflow-hidden border transition-all duration-300"
              [ngClass]="i === activeIndex()
                ? 'border-primary shadow-[0_16px_36px_rgba(10,37,64,0.16)]'
                : 'border-border shadow-[0_8px_24px_rgba(10,37,64,0.10)]'">

              <div class="relative aspect-[9/16] bg-black">
                <img
                  *ngIf="!videoReady()[item.id]"
                  [src]="item.posterUrl || fallbackPoster"
                  alt="Poster"
                  class="absolute inset-0 w-full h-full object-cover" />

                <video
                  #videoEl
                  [attr.data-id]="item.id"
                  [attr.data-index]="i"
                  [attr.src]="shouldLoad()[item.id] ? item.url : null"
                  [poster]="item.posterUrl || fallbackPoster"
                  [attr.preload]="getPreloadMode(i)"
                  playsinline
                  [muted]="mutedState()[item.id]"
                  class="w-full h-full object-cover"
                  (loadeddata)="onVideoLoaded(item.id, i)"
                  (play)="onVideoPlay(item.id)"
                  (pause)="onVideoPause(item.id)"
                  (error)="onVideoError(item.id, $event)">
                </video>

                <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

                <button
                  type="button"
                  (click)="togglePlay(i)"
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 h-14 w-14 rounded-full bg-black/45 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm shadow-xl">
                  <svg *ngIf="!(playingState()[item.id])" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" class="ml-0.5"><path d="M8 5.5v13l10-6.5z"></path></svg>
                  <svg *ngIf="playingState()[item.id]" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="4" height="14" rx="1"></rect><rect x="13" y="5" width="4" height="14" rx="1"></rect></svg>
                </button>

                <button
                  type="button"
                  (click)="toggleAudio(i)"
                  class="absolute top-3 right-3 z-20 h-10 w-10 rounded-full bg-black/45 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm"
                  [disabled]="!videoReady()[item.id]">
                  <svg *ngIf="mutedState()[item.id] ?? true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                  <svg *ngIf="!(mutedState()[item.id] ?? true)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>

                <div class="absolute left-4 right-4 bottom-4 z-20 text-white">
                  <div class="text-base font-semibold leading-tight">{{ item.title }}</div>
                  <p class="text-[13px] leading-snug text-white/90 mt-1">"{{ item.quote }}"</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class TestimonialsAllComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('cardEl') cardEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('videoEl') videoEls!: QueryList<ElementRef<HTMLVideoElement>>;

  readonly videos = signal<VideoManifestItem[]>([]);
  readonly loading = signal<boolean>(true);
  readonly activeIndex = signal<number>(0);
  readonly shouldLoad = signal<Record<string, boolean>>({});
  readonly videoReady = signal<Record<string, boolean>>({});
  readonly mutedState = signal<Record<string, boolean>>({});
  readonly playingState = signal<Record<string, boolean>>({});

  readonly fallbackPoster =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230a2540"/><stop offset="100%" stop-color="%231e4e7a"/></linearGradient></defs><rect width="720" height="1280" fill="url(%23g)"/><text x="52" y="110" fill="white" font-family="Arial" font-size="52" font-weight="700">FastEMIs Story</text><text x="52" y="1190" fill="%239ec9ea" font-family="Arial" font-size="26">Tap to Play</text></svg>';

  private deviceClass: DeviceClass = 'desktop';
  private cardObserver: IntersectionObserver | null = null;
  private scrollDebounceTimer: number | null = null;
  private firstFrameLogged = false;
  private autoplayRejectCount = 0;
  private videoErrorCount = 0;

  constructor(private manifestService: VideoManifestService) { }

  ngOnInit(): void {
    this.deviceClass = window.innerWidth < 768 ? 'mobile' : 'desktop';
    this.fetchManifest();
  }

  ngAfterViewInit(): void {
    this.cardEls.changes.subscribe(() => {
      this.setupLazyObserver();
      window.setTimeout(() => this.playActiveMuted('view_init'), 50);
    });
  }

  ngOnDestroy(): void {
    this.disconnectObserver();
    if (this.scrollDebounceTimer !== null) {
      window.clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    this.videoEls?.forEach((ref) => ref.nativeElement.pause());
  }

  @HostListener('window:resize')
  onResize(): void {
    const nextDevice: DeviceClass = window.innerWidth < 768 ? 'mobile' : 'desktop';
    if (nextDevice !== this.deviceClass) {
      this.deviceClass = nextDevice;
      this.fetchManifest();
    }
  }

  trackByVideo(_: number, item: VideoManifestItem): string {
    return item.id;
  }

  onScroll(): void {
    if (this.scrollDebounceTimer !== null) {
      window.clearTimeout(this.scrollDebounceTimer);
    }
    this.scrollDebounceTimer = window.setTimeout(() => this.updateCenteredActiveIndex(), 120);
  }

  scrollPrev(): void {
    const nextIndex = this.wrapIndex(this.activeIndex() - 1);
    this.scrollToIndex(nextIndex);
  }

  scrollNext(): void {
    const nextIndex = this.wrapIndex(this.activeIndex() + 1);
    this.scrollToIndex(nextIndex);
  }

  togglePlay(index: number): void {
    const target = this.videoEls.get(index)?.nativeElement;
    if (!target) {
      return;
    }

    this.setActiveIndex(index, 'manual_play');

    if (!target.paused && this.playingState()[this.videos()[index].id]) {
      target.pause();
      this.playingState.update((prev) => ({ ...prev, [this.videos()[index].id]: false }));
      return;
    }

    this.unmuteOnly(index);
    this.playVideoAt(index, true, 'manual_play');
  }

  toggleAudio(index: number): void {
    const video = this.videoEls.get(index)?.nativeElement;
    const item = this.videos()[index];
    if (!video || !item) {
      return;
    }

    const currentlyMuted = this.mutedState()[item.id] ?? true;
    if (currentlyMuted) {
      this.unmuteOnly(index);
      this.playVideoAt(index, true, 'audio_unmute');
      return;
    }

    video.muted = true;
    this.mutedState.update((prev) => ({ ...prev, [item.id]: true }));
  }

  onVideoLoaded(id: string, index: number): void {
    this.videoReady.update((prev) => ({ ...prev, [id]: true }));
    if (!this.firstFrameLogged && index === this.activeIndex()) {
      this.firstFrameLogged = true;
      console.info('[video-metrics] testimonials:first-frame-ready');
    }

    if (index === this.activeIndex()) {
      this.playActiveMuted('loadeddata');
    }
  }

  onVideoPlay(id: string): void {
    this.playingState.update((prev) => ({ ...prev, [id]: true }));
  }

  onVideoPause(id: string): void {
    this.playingState.update((prev) => ({ ...prev, [id]: false }));
  }

  onVideoError(id: string, event: Event): void {
    this.videoErrorCount += 1;
    console.warn('[video-metrics] testimonials:video-error', {
      id,
      errorCount: this.videoErrorCount,
      event
    });
  }

  private fetchManifest(): void {
    this.loading.set(true);
    this.firstFrameLogged = false;

    this.manifestService.getManifest('testimonials', this.deviceClass).subscribe((payload) => {
      const items = payload.items.filter((item) => item.active && !!item.url);
      this.videos.set(items);
      this.activeIndex.set(0);

      const loadMap: Record<string, boolean> = {};
      const readyMap: Record<string, boolean> = {};
      const muteMap: Record<string, boolean> = {};
      const playMap: Record<string, boolean> = {};

      items.forEach((item, idx) => {
        loadMap[item.id] = idx === 0;
        readyMap[item.id] = false;
        muteMap[item.id] = true;
        playMap[item.id] = false;
      });

      this.shouldLoad.set(loadMap);
      this.videoReady.set(readyMap);
      this.mutedState.set(muteMap);
      this.playingState.set(playMap);
      this.loading.set(false);

      window.setTimeout(() => {
        this.setupLazyObserver();
        this.scrollToIndex(0, false);
        this.playActiveMuted('manifest_loaded');
      }, 60);
    });
  }

  private setupLazyObserver(): void {
    this.disconnectObserver();

    const root = this.scrollContainerRef?.nativeElement;
    if (!root) {
      return;
    }

    this.cardObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const element = entry.target as HTMLElement;
          const index = Number(element.dataset['index'] || '-1');
          const item = this.videos()[index];
          if (!item) {
            continue;
          }

          if (!this.shouldLoad()[item.id]) {
            this.shouldLoad.update((prev) => ({ ...prev, [item.id]: true }));
          }
        }
      },
      {
        root,
        rootMargin: '180px',
        threshold: 0.08
      }
    );

    this.cardEls.forEach((cardRef, index) => {
      const node = cardRef.nativeElement;
      node.dataset['index'] = String(index);
      this.cardObserver?.observe(node);
    });
  }

  private disconnectObserver(): void {
    if (this.cardObserver) {
      this.cardObserver.disconnect();
      this.cardObserver = null;
    }
  }

  private updateCenteredActiveIndex(): void {
    const container = this.scrollContainerRef?.nativeElement;
    if (!container || !this.cardEls.length) {
      return;
    }

    const center = container.scrollLeft + container.clientWidth / 2;
    let nearestIndex = this.activeIndex();
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.cardEls.forEach((cardRef, index) => {
      const card = cardRef.nativeElement;
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestIndex !== this.activeIndex()) {
      this.setActiveIndex(nearestIndex, 'scroll_center');
      this.playActiveMuted('scroll_center');
    }
  }

  private setActiveIndex(index: number, reason: string): void {
    const normalized = this.wrapIndex(index);
    this.activeIndex.set(normalized);

    const item = this.videos()[normalized];
    if (item && !this.shouldLoad()[item.id]) {
      this.shouldLoad.update((prev) => ({ ...prev, [item.id]: true }));
    }

    console.info('[video-metrics] testimonials:active-change', {
      reason,
      index: normalized,
      id: item?.id
    });
  }

  private playActiveMuted(reason: string): void {
    const index = this.activeIndex();
    this.playVideoAt(index, false, reason);
  }

  private playVideoAt(index: number, unmute: boolean, reason: string): void {
    const activeItem = this.videos()[index];
    const activeVideo = this.videoEls.get(index)?.nativeElement;
    if (!activeItem || !activeVideo) {
      return;
    }

    this.pauseAllExcept(index);

    if (unmute) {
      this.unmuteOnly(index);
    } else {
      activeVideo.muted = true;
      this.mutedState.update((prev) => ({ ...prev, [activeItem.id]: true }));
    }

    const playPromise = activeVideo.play();
    if (!playPromise || typeof playPromise.then !== 'function') {
      return;
    }

    playPromise.catch((error) => {
      this.autoplayRejectCount += 1;
      console.warn('[video-metrics] testimonials:play-rejected', {
        id: activeItem.id,
        reason,
        rejects: this.autoplayRejectCount,
        error
      });
    });
  }

  getPreloadMode(index: number): 'metadata' | 'none' {
    const total = this.videos().length;
    if (!total) {
      return 'none';
    }
    const active = this.activeIndex();
    const prev = this.wrapIndex(active - 1);
    const next = this.wrapIndex(active + 1);
    return (index === active || index === prev || index === next) ? 'metadata' : 'none';
  }

  private pauseAllExcept(index: number): void {
    this.videoEls.forEach((videoRef, idx) => {
      if (idx === index) {
        return;
      }
      videoRef.nativeElement.pause();
      const item = this.videos()[idx];
      if (item) {
        this.playingState.update((prev) => ({ ...prev, [item.id]: false }));
      }
    });
  }

  private unmuteOnly(index: number): void {
    const nextMuted: Record<string, boolean> = { ...this.mutedState() };
    this.videoEls.forEach((videoRef, idx) => {
      const item = this.videos()[idx];
      if (!item) {
        return;
      }
      const shouldMute = idx !== index;
      videoRef.nativeElement.muted = shouldMute;
      nextMuted[item.id] = shouldMute;
    });
    this.mutedState.set(nextMuted);
  }

  private wrapIndex(index: number): number {
    const total = this.videos().length;
    if (!total) {
      return 0;
    }
    return ((index % total) + total) % total;
  }

  private scrollToIndex(index: number, smooth = true): void {
    const container = this.scrollContainerRef?.nativeElement;
    const card = this.cardEls.get(index)?.nativeElement;
    if (!container || !card) {
      return;
    }

    const left = card.offsetLeft - (container.clientWidth - card.clientWidth) / 2;
    container.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    this.setActiveIndex(index, 'manual_scroll');
  }
}
