import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentVideoItem } from '../../../../core/models/agent-video.model';
import { AgentVideoApiService } from '../../../../core/services/agent-video-api.service';

type VideoFilter = 'all' | 'active' | 'disabled';

@Component({
  selector: 'app-agent-video-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-2 sm:px-4 pb-8 space-y-6">
      <header class="rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-primary">Testimonials Video Management</h1>
            <p class="text-sm text-secondary mt-1">
              Upload new videos and manage existing video visibility without deleting historical assets.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="refresh()"
              [disabled]="loading() || actionBusy()"
              class="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-primary hover:bg-surface disabled:opacity-60">
              {{ loading() ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded-xl border border-border bg-surface-2 px-3 py-3">
            <div class="text-xs text-muted uppercase tracking-wider font-semibold">Total Videos</div>
            <div class="text-xl font-bold text-primary mt-1">{{ videos().length }}</div>
          </div>
          <div class="rounded-xl border border-border bg-surface-2 px-3 py-3">
            <div class="text-xs text-muted uppercase tracking-wider font-semibold">Active</div>
            <div class="text-xl font-bold text-primary mt-1">{{ activeCount() }}</div>
          </div>
          <div class="rounded-xl border border-border bg-surface-2 px-3 py-3">
            <div class="text-xs text-muted uppercase tracking-wider font-semibold">Hero Enabled</div>
            <div class="text-xl font-bold text-primary mt-1">{{ heroCount() }}</div>
          </div>
        </div>
      </header>

      <section class="rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm">
        <h2 class="text-lg font-bold text-primary mb-1">Upload New Testimonial Video</h2>
        <p class="text-sm text-secondary mb-4">Upload once. Then enable or disable from the management list as needed.</p>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-primary mb-1">Title *</label>
            <input
              [(ngModel)]="newTitle"
              type="text"
              placeholder="Example: Monica S."
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-primary focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-primary mb-1">Priority *</label>
            <input
              [(ngModel)]="newPriority"
              type="number"
              min="1"
              max="10000"
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-primary focus:outline-none focus:border-primary" />
          </div>

          <div class="lg:col-span-2">
            <label class="block text-xs font-semibold text-primary mb-1">Quote</label>
            <textarea
              [(ngModel)]="newQuote"
              rows="2"
              maxlength="320"
              placeholder="Optional user quote shown on hero/testimonials cards."
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-primary focus:outline-none focus:border-primary resize-none"></textarea>
          </div>

          <div>
            <label class="block text-xs font-semibold text-primary mb-1">Duration (seconds)</label>
            <input
              [(ngModel)]="newDurationSec"
              type="number"
              min="0"
              max="1200"
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-primary focus:outline-none focus:border-primary" />
          </div>

          <div class="flex items-end">
            <label class="inline-flex items-center gap-2 text-sm text-primary font-medium cursor-pointer">
              <input [(ngModel)]="newShowInHero" type="checkbox" class="h-4 w-4 rounded border-border text-primary">
              Show in Hero stories
            </label>
          </div>

          <div class="lg:col-span-2">
            <label class="block text-xs font-semibold text-primary mb-1">Video File *</label>
            <input
              type="file"
              accept="video/*"
              (change)="onFileSelected($event)"
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-primary file:mr-3 file:border-0 file:bg-primary file:text-white file:px-3 file:py-1.5 file:rounded-md file:text-xs file:font-semibold" />
            <p class="text-xs text-muted mt-1" *ngIf="selectedFileName()">{{ selectedFileName() }}</p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            (click)="uploadVideo()"
            [disabled]="!canUpload() || actionBusy()"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60 disabled:cursor-not-allowed">
            {{ actionBusy() ? 'Uploading...' : 'Upload Video' }}
          </button>
          <p *ngIf="successMessage()" class="text-sm text-success">{{ successMessage() }}</p>
          <p *ngIf="actionError()" class="text-sm text-error">{{ actionError() }}</p>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div class="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-primary">Manage Existing Videos</h2>
          <div class="inline-flex rounded-lg border border-border bg-surface-2 p-1">
            <button type="button" (click)="filterState.set('all')" [class]="filterBtnClass('all')">All</button>
            <button type="button" (click)="filterState.set('active')" [class]="filterBtnClass('active')">Active</button>
            <button type="button" (click)="filterState.set('disabled')" [class]="filterBtnClass('disabled')">Disabled</button>
          </div>
        </div>

        <div *ngIf="loading()" class="p-8 text-center text-secondary text-sm">Loading videos...</div>
        <div *ngIf="!loading() && filteredVideos().length === 0" class="p-8 text-center text-secondary text-sm">No videos found for this filter.</div>

        <div *ngIf="!loading()" class="divide-y divide-border">
          <article *ngFor="let video of filteredVideos(); trackBy: trackByVideo" class="p-4 sm:p-5">
            <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
              <div class="rounded-xl border border-border bg-black overflow-hidden">
                <video
                  [poster]="video.poster_url || ''"
                  [src]="video.preview_url || video.uploaded_video_url || ''"
                  controls
                  muted
                  playsinline
                  preload="none"
                  class="w-full h-[220px] object-cover">
                </video>
              </div>

              <div class="space-y-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 class="text-base sm:text-lg font-bold text-primary">{{ video.title }}</h3>
                    <p class="text-xs text-muted mt-0.5 font-mono">Slug: {{ video.slug }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold"
                      [ngClass]="video.is_active ? 'bg-success/10 text-success border border-success/30' : 'bg-error/10 text-error border border-error/30'">
                      {{ video.is_active ? 'Active' : 'Disabled' }}
                    </span>
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold border"
                      [ngClass]="video.show_in_hero ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface-2 text-secondary border-border'">
                      {{ video.show_in_hero ? 'Hero: On' : 'Hero: Off' }}
                    </span>
                  </div>
                </div>

                <p class="text-sm text-secondary leading-relaxed">
                  {{ video.quote || 'No quote added for this testimonial yet.' }}
                </p>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div class="rounded-lg border border-border bg-surface-2 px-3 py-2">
                    <div class="text-muted">Priority</div>
                    <div class="font-semibold text-primary">{{ video.priority }}</div>
                  </div>
                  <div class="rounded-lg border border-border bg-surface-2 px-3 py-2">
                    <div class="text-muted">Duration</div>
                    <div class="font-semibold text-primary">{{ video.duration_sec || 0 }} sec</div>
                  </div>
                  <div class="rounded-lg border border-border bg-surface-2 px-3 py-2">
                    <div class="text-muted">Source</div>
                    <div class="font-semibold text-primary">{{ video.has_source ? 'Available' : 'Missing' }}</div>
                  </div>
                  <div class="rounded-lg border border-border bg-surface-2 px-3 py-2">
                    <div class="text-muted">Updated</div>
                    <div class="font-semibold text-primary">{{ formatDate(video.updated_at) }}</div>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    (click)="toggleActive(video)"
                    [disabled]="actionBusy()"
                    class="rounded-lg px-3 py-2 text-sm font-semibold border"
                    [ngClass]="video.is_active
                      ? 'border-error/30 text-error bg-error/5 hover:bg-error/10'
                      : 'border-success/30 text-success bg-success/5 hover:bg-success/10'">
                    {{ video.is_active ? 'Disable Video' : 'Enable Video' }}
                  </button>

                  <button
                    type="button"
                    (click)="toggleHero(video)"
                    [disabled]="actionBusy()"
                    class="rounded-lg px-3 py-2 text-sm font-semibold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10">
                    {{ video.show_in_hero ? 'Remove from Hero' : 'Add to Hero' }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  `
})
export class AgentVideoManagementComponent implements OnInit {
  private readonly videoApi = inject(AgentVideoApiService);

  readonly videos = this.videoApi.videos;
  readonly loading = this.videoApi.loading;
  readonly actionBusy = this.videoApi.actionBusy;
  readonly actionError = this.videoApi.actionError;

  readonly filterState = signal<VideoFilter>('all');
  readonly successMessage = signal<string>('');
  readonly selectedFileName = signal<string>('');

  readonly filteredVideos = computed(() => {
    const filter = this.filterState();
    const all = this.videos();
    if (filter === 'active') return all.filter((item) => item.is_active);
    if (filter === 'disabled') return all.filter((item) => !item.is_active);
    return all;
  });

  readonly activeCount = computed(() => this.videos().filter((item) => item.is_active).length);
  readonly heroCount = computed(() => this.videos().filter((item) => item.show_in_hero && item.is_active).length);

  newTitle = '';
  newQuote = '';
  newPriority = 100;
  newDurationSec = 0;
  newShowInHero = false;
  newVideoFile: File | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.videoApi.loadVideos(true).subscribe();
  }

  canUpload(): boolean {
    return this.newTitle.trim().length > 0 && !!this.newVideoFile;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.newVideoFile = file;
    this.selectedFileName.set(file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : '');
  }

  uploadVideo(): void {
    if (!this.canUpload() || !this.newVideoFile || this.actionBusy()) return;
    this.successMessage.set('');

    this.videoApi.createVideo({
      title: this.newTitle,
      quote: this.newQuote,
      priority: Number(this.newPriority || 100),
      durationSec: Number(this.newDurationSec || 0),
      showInHero: this.newShowInHero,
      videoFile: this.newVideoFile
    }).subscribe((created) => {
      if (!created) return;
      this.successMessage.set('Video uploaded successfully.');
      this.newTitle = '';
      this.newQuote = '';
      this.newPriority = 100;
      this.newDurationSec = 0;
      this.newShowInHero = false;
      this.newVideoFile = null;
      this.selectedFileName.set('');
      this.refresh();
    });
  }

  toggleActive(video: AgentVideoItem): void {
    if (this.actionBusy()) return;
    this.successMessage.set('');
    this.videoApi.updateVideo(video.id, { is_active: !video.is_active }).subscribe((updated) => {
      if (!updated) return;
      this.successMessage.set(updated.is_active ? 'Video enabled.' : 'Video disabled.');
      this.refresh();
    });
  }

  toggleHero(video: AgentVideoItem): void {
    if (this.actionBusy()) return;
    this.successMessage.set('');
    this.videoApi.updateVideo(video.id, { show_in_hero: !video.show_in_hero }).subscribe((updated) => {
      if (!updated) return;
      this.successMessage.set(updated.show_in_hero ? 'Video added to hero.' : 'Video removed from hero.');
      this.refresh();
    });
  }

  trackByVideo(_: number, item: AgentVideoItem): number {
    return item.id;
  }

  filterBtnClass(filter: VideoFilter): string {
    const selected = this.filterState() === filter;
    return [
      'px-3 py-1.5 rounded text-xs font-semibold transition-colors',
      selected ? 'bg-primary text-white' : 'text-secondary hover:bg-surface'
    ].join(' ');
  }

  formatDate(value: string | null): string {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
  }
}
