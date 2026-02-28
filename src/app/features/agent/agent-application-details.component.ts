import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgentFieldStatus, AgentUserDetail } from '../../core/models/agent-user.model';
import { AgentUserApiService } from '../../core/services/agent-user-api.service';

@Component({
  selector: 'app-agent-application-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-3 sm:px-5 lg:px-8 max-w-6xl mx-auto pb-10">
      <a routerLink="/agent" class="inline-flex items-center gap-2 text-sm text-secondary no-underline hover:text-primary my-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Applicants
      </a>

      <div *ngIf="loading()" class="rounded-xl border border-border bg-surface p-10 flex items-center justify-center">
        <div class="w-8 h-8 rounded-full border-2 border-surface-3 border-t-primary animate-spin"></div>
      </div>

      <ng-container *ngIf="!loading() && user(); else emptyState">
        <section class="rounded-xl border border-border bg-surface p-4 sm:p-5 mb-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 class="text-xl sm:text-2xl font-semibold text-primary">{{ displayValue(user()!.full_name) }}</h1>
              <p class="text-sm text-secondary">User ID: {{ user()!.id }}</p>
              <p class="text-xs text-secondary">Last Login: {{ formatDateTime(user()!.last_login) }}</p>
              <p class="text-xs text-secondary mt-1">Last Location: {{ locationSummary() }}</p>
              <a
                *ngIf="locationMapsUrl()"
                [href]="locationMapsUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-xs text-primary no-underline hover:underline mt-1">
                Open on map
              </a>
            </div>
            <div class="text-left sm:text-right">
              <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                [ngClass]="user()!.profile_complete ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'">
                {{ user()!.profile_complete ? 'Profile Filled' : 'Not Filled Yet' }}
              </span>
              <p class="mt-1 text-xs text-secondary">{{ user()!.profile_progress }}% complete</p>
            </div>
          </div>
        </section>

        <div class="mb-4 flex gap-2">
          <button type="button" (click)="setTab('profile')" class="px-4 py-2 rounded-lg border text-sm"
            [ngClass]="activeTab() === 'profile' ? 'bg-primary text-white border-primary' : 'border-border text-secondary hover:text-primary'">
            Profile Details
          </button>
          <button type="button" (click)="setTab('management')" class="px-4 py-2 rounded-lg border text-sm"
            [ngClass]="activeTab() === 'management' ? 'bg-primary text-white border-primary' : 'border-border text-secondary hover:text-primary'">
            Management
          </button>
        </div>

        <section *ngIf="activeTab() === 'profile'" class="rounded-xl border border-border bg-surface overflow-hidden">
          <div class="px-4 py-3 border-b border-border bg-surface-2 text-sm font-semibold text-primary">
            Signup + Profile Completion Fields
          </div>

          <div class="md:hidden divide-y divide-border">
            <div *ngFor="let field of user()!.field_statuses; trackBy: trackByFieldKey" class="px-4 py-3">
              <div class="flex items-center justify-between gap-2 mb-1">
                <p class="text-sm font-medium text-primary">{{ field.label }}</p>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  [ngClass]="statusClass(field.status)">
                  {{ statusLabel(field.status) }}
                </span>
              </div>
              <ng-container *ngIf="isPreviewableMedia(field); else textValueMobile">
                <div class="rounded-lg border border-border bg-surface p-2">
                  <img
                    *ngIf="mediaType(field.value) === 'image'"
                    [src]="mediaUrl(field.value)"
                    alt="Uploaded media"
                    loading="lazy"
                    decoding="async"
                    class="w-full max-h-48 object-contain rounded bg-surface-2" />
                  <video
                    *ngIf="mediaType(field.value) === 'video'"
                    [src]="mediaUrl(field.value)"
                    controls
                    preload="metadata"
                    class="w-full max-h-56 rounded bg-black"></video>
                  <a
                    *ngIf="mediaType(field.value) === 'file'"
                    [href]="mediaUrl(field.value)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 text-sm text-primary no-underline hover:underline">
                    Open file
                  </a>
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    (click)="openMediaPreview(field)"
                    class="px-2.5 py-1 rounded-md border border-border text-xs text-primary hover:bg-surface-2">
                    Preview
                  </button>
                  <a
                    [href]="mediaUrl(field.value)"
                    [attr.download]="fileName(field.value) || null"
                    class="px-2.5 py-1 rounded-md border border-border text-xs text-primary no-underline hover:bg-surface-2">
                    Download
                  </a>
                </div>
                <p class="text-[11px] text-muted mt-1 break-all">{{ fileName(field.value) }}</p>
              </ng-container>
              <ng-template #textValueMobile>
                <p class="text-sm text-secondary break-all">{{ field.value }}</p>
              </ng-template>
            </div>
          </div>

          <div class="hidden md:block overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-surface-2 text-secondary border-b border-border">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">Field</th>
                  <th class="px-4 py-3 text-left font-medium">Value</th>
                  <th class="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr *ngFor="let field of user()!.field_statuses; trackBy: trackByFieldKey">
                  <td class="px-4 py-3 text-primary font-medium">{{ field.label }}</td>
                  <td class="px-4 py-3 text-secondary break-all">
                    <ng-container *ngIf="isPreviewableMedia(field); else textValueDesktop">
                      <div class="max-w-[280px] rounded-lg border border-border bg-surface p-2">
                        <img
                          *ngIf="mediaType(field.value) === 'image'"
                          [src]="mediaUrl(field.value)"
                          alt="Uploaded media"
                          loading="lazy"
                          decoding="async"
                          class="w-full max-h-32 object-contain rounded bg-surface-2" />
                        <video
                          *ngIf="mediaType(field.value) === 'video'"
                          [src]="mediaUrl(field.value)"
                          controls
                          preload="metadata"
                          class="w-full max-h-36 rounded bg-black"></video>
                        <a
                          *ngIf="mediaType(field.value) === 'file'"
                          [href]="mediaUrl(field.value)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-2 text-xs text-primary no-underline hover:underline">
                          Open file
                        </a>
                      </div>
                      <div class="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          (click)="openMediaPreview(field)"
                          class="px-2.5 py-1 rounded-md border border-border text-xs text-primary hover:bg-surface-2">
                          Preview
                        </button>
                        <a
                          [href]="mediaUrl(field.value)"
                          [attr.download]="fileName(field.value) || null"
                          class="px-2.5 py-1 rounded-md border border-border text-xs text-primary no-underline hover:bg-surface-2">
                          Download
                        </a>
                      </div>
                      <p class="text-[11px] text-muted mt-1 break-all">{{ fileName(field.value) }}</p>
                    </ng-container>
                    <ng-template #textValueDesktop>{{ field.value }}</ng-template>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold"
                      [ngClass]="statusClass(field.status)">
                      {{ statusLabel(field.status) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section *ngIf="activeTab() === 'management'" class="space-y-4">
          <div class="rounded-xl border border-border bg-surface p-4">
            <p class="text-sm text-secondary mb-1">Account Status</p>
            <p class="text-base font-semibold" [ngClass]="user()!.is_active ? 'text-success' : 'text-error'">
              {{ user()!.is_active ? 'Active' : 'Disabled' }}
            </p>

            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" *ngIf="user()!.is_active" (click)="disableUser()" [disabled]="actionBusy()"
                class="px-4 py-2 rounded-lg border border-warning text-warning text-sm hover:bg-warning/10 disabled:opacity-60">
                Disable User
              </button>
              <button type="button" *ngIf="!user()!.is_active" (click)="enableUser()" [disabled]="actionBusy()"
                class="px-4 py-2 rounded-lg border border-success text-success text-sm hover:bg-success/10 disabled:opacity-60">
                Enable User
              </button>
              <button type="button" (click)="deleteUser()" [disabled]="actionBusy()"
                class="px-4 py-2 rounded-lg border border-error text-error text-sm hover:bg-error/10 disabled:opacity-60">
                Delete User
              </button>
            </div>
          </div>

          <p *ngIf="actionMessage()" class="text-sm rounded-lg border px-3 py-2"
            [ngClass]="actionError() ? 'border-error/30 bg-error/10 text-error' : 'border-success/30 bg-success/10 text-success'">
            {{ actionMessage() }}
          </p>
        </section>
      </ng-container>

      <ng-template #emptyState>
        <div *ngIf="!loading()" class="rounded-xl border border-border bg-surface p-6 text-center text-secondary">
          User not found.
        </div>
      </ng-template>

      <div *ngIf="previewField()" class="fixed inset-0 z-[95] bg-black/85 p-4 flex flex-col">
        <div class="flex items-center justify-between text-white mb-3">
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">{{ previewField()?.label }}</p>
            <p class="text-xs text-white/70 truncate">{{ fileName(previewField()?.value || '') }}</p>
          </div>
          <button
            type="button"
            (click)="closeMediaPreview()"
            class="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
            X
          </button>
        </div>

        <div class="flex-1 min-h-0 rounded-xl border border-white/20 bg-black/30 p-3 flex items-center justify-center overflow-auto">
          <img
            *ngIf="previewField() && mediaType(previewField()!.value) === 'image'"
            [src]="mediaUrl(previewField()!.value)"
            alt="Media preview"
            class="max-h-full max-w-full object-contain rounded" />
          <video
            *ngIf="previewField() && mediaType(previewField()!.value) === 'video'"
            [src]="mediaUrl(previewField()!.value)"
            controls
            autoplay
            class="max-h-full max-w-full rounded bg-black"></video>
          <iframe
            *ngIf="previewField() && mediaType(previewField()!.value) === 'file' && isEmbeddableFile(previewField()!.value)"
            [src]="mediaUrl(previewField()!.value)"
            class="w-full h-full rounded bg-white"
            title="File preview">
          </iframe>
          <div
            *ngIf="previewField() && mediaType(previewField()!.value) === 'file' && !isEmbeddableFile(previewField()!.value)"
            class="text-center text-white">
            <p class="text-sm mb-3">Preview is not available for this file type.</p>
            <a
              [href]="mediaUrl(previewField()!.value)"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center rounded-lg border border-white/50 px-3 py-2 text-sm text-white no-underline">
              Open File
            </a>
          </div>
        </div>

        <div class="pt-3 flex justify-end">
          <a
            *ngIf="previewField()"
            [href]="mediaUrl(previewField()!.value)"
            [attr.download]="fileName(previewField()!.value) || null"
            class="inline-flex items-center rounded-lg border border-white/50 px-3 py-2 text-sm text-white no-underline hover:bg-white/10">
            Download
          </a>
        </div>
      </div>
    </div>
  `
})
export class AgentApplicationDetailsComponent implements OnInit {
  readonly user = signal<AgentUserDetail | null>(null);
  readonly loading = signal<boolean>(true);
  readonly actionBusy = signal<boolean>(false);
  readonly actionMessage = signal<string>('');
  readonly actionError = signal<boolean>(false);
  readonly activeTab = signal<'profile' | 'management'>('profile');
  readonly previewField = signal<AgentFieldStatus | null>(null);

  private userId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private agentUsersApi: AgentUserApiService
  ) { }

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (!routeId) {
      this.loading.set(false);
      return;
    }

    this.userId = routeId;
    const queryTab = this.route.snapshot.queryParamMap.get('tab');
    if (queryTab === 'management') {
      this.activeTab.set('management');
    }

    this.loadDetails();
  }

  setTab(tab: 'profile' | 'management'): void {
    this.activeTab.set(tab);
  }

  disableUser(): void {
    this.toggleUser(false);
  }

  enableUser(): void {
    this.toggleUser(true);
  }

  deleteUser(): void {
    const current = this.user();
    if (!current) return;
    if (!confirm(`Delete ${this.displayValue(current.full_name)} permanently?`)) {
      return;
    }

    this.actionBusy.set(true);
    this.actionMessage.set('');
    this.agentUsersApi.deleteUser(current.id).subscribe((ok) => {
      this.actionBusy.set(false);
      if (!ok) {
        this.actionError.set(true);
        this.actionMessage.set('Delete failed. Please try again.');
        return;
      }
      this.router.navigate(['/agent']);
    });
  }

  trackByFieldKey(_index: number, field: AgentFieldStatus): string {
    return field.key;
  }

  statusLabel(status: AgentFieldStatus['status']): string {
    if (status === 'filled') return 'Filled';
    if (status === 'not_required') return 'Not Required';
    return 'Not Filled Yet';
  }

  statusClass(status: AgentFieldStatus['status']): string {
    if (status === 'filled') return 'bg-success/10 text-success';
    if (status === 'not_required') return 'bg-surface-2 text-secondary';
    return 'bg-warning/10 text-warning';
  }

  displayValue(value: string): string {
    const raw = String(value || '').trim();
    return raw || 'Not filled yet';
  }

  formatDateTime(value: string | null): string {
    if (!value) return 'Not filled yet';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  locationSummary(): string {
    const location = this.user()?.last_location;
    if (!location || location.latitude === null || location.longitude === null) {
      return 'Not shared yet';
    }

    const lat = Number(location.latitude).toFixed(5);
    const lng = Number(location.longitude).toFixed(5);
    const acc = location.accuracy_m !== null && location.accuracy_m !== undefined
      ? ` (±${Math.round(location.accuracy_m)}m)`
      : '';
    const time = location.captured_at ? ` at ${this.formatDateTime(location.captured_at)}` : '';
    return `Lat ${lat}, Lng ${lng}${acc}${time}`;
  }

  locationMapsUrl(): string {
    const location = this.user()?.last_location;
    return String(location?.maps_url || '').trim();
  }

  isPreviewableMedia(field: AgentFieldStatus): boolean {
    const value = String(field.value || '').trim();
    if (!value || value.toLowerCase() === 'not filled yet' || value.toLowerCase() === 'not required') {
      return false;
    }
    const mediaKeys = new Set(['aadhar_image', 'pancard_image', 'live_photo']);
    return mediaKeys.has(field.key) || value.startsWith('/media/') || /^https?:\/\//i.test(value);
  }

  mediaType(value: string): 'image' | 'video' | 'file' {
    const lower = String(value || '').toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(lower)) {
      return 'image';
    }
    if (/\.(mp4|webm|ogg|mov|m4v)$/.test(lower)) {
      return 'video';
    }
    return 'file';
  }

  mediaUrl(value: string): string {
    return String(value || '').trim();
  }

  openMediaPreview(field: AgentFieldStatus): void {
    if (!this.isPreviewableMedia(field)) {
      return;
    }
    this.previewField.set(field);
  }

  closeMediaPreview(): void {
    this.previewField.set(null);
  }

  isEmbeddableFile(value: string): boolean {
    const lower = String(value || '').toLowerCase();
    return /\.(pdf|txt)$/i.test(lower);
  }

  fileName(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parts = raw.split('/');
    return parts[parts.length - 1] || raw;
  }

  private loadDetails(): void {
    this.loading.set(true);
    this.agentUsersApi.getUserDetail(this.userId).subscribe((detail) => {
      this.user.set(detail);
      this.loading.set(false);
    });
  }

  private toggleUser(enable: boolean): void {
    const current = this.user();
    if (!current) return;

    this.actionBusy.set(true);
    this.actionMessage.set('');
    this.agentUsersApi.setUserEnabled(current.id, enable).subscribe((detail) => {
      this.actionBusy.set(false);
      if (!detail) {
        this.actionError.set(true);
        this.actionMessage.set('Update failed. Please try again.');
        return;
      }
      this.user.set(detail);
      this.actionError.set(false);
      this.actionMessage.set(enable ? 'User enabled successfully.' : 'User disabled successfully.');
    });
  }
}
