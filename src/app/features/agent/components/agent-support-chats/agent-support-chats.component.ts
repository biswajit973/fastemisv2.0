import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChatService, ChatThreadSummary } from '../../../../core/services/chat.service';

@Component({
    selector: 'app-agent-support-chats',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-8">
      <div class="mb-6 flex flex-col gap-3">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 class="text-2xl sm:text-3xl font-display font-bold text-primary mb-1">Support Inboxes</h1>
            <p class="text-sm text-secondary">All private support chats with users.</p>
          </div>
          <button
            type="button"
            (click)="refresh()"
            [disabled]="loading()"
            class="px-3 py-2 rounded-lg border border-border text-sm text-primary hover:bg-surface-2 disabled:opacity-60">
            {{ loading() ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <div class="bg-surface border border-border rounded-xl p-3">
          <label class="block text-xs text-secondary mb-1">Search by name/number/email</label>
          <div class="flex items-center gap-2">
            <input
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchChange($event)"
              type="text"
              placeholder="Type to search..."
              class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:border-primary" />
            <button
              type="button"
              (click)="clearSearch()"
              [disabled]="!searchTerm.trim()"
              class="px-3 py-2 rounded-lg border border-border text-xs text-secondary hover:text-primary disabled:opacity-50">
              Clear
            </button>
          </div>
        </div>
      </div>

      <div class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div *ngIf="loading() && threads().length === 0" class="p-8 flex items-center justify-center">
          <div class="w-8 h-8 rounded-full border-2 border-surface-3 border-t-primary animate-spin"></div>
        </div>

        <div *ngIf="!loading() && threads().length === 0" class="p-8 text-center text-secondary">No support chats found.</div>

        <div class="divide-y divide-border" *ngIf="threads().length > 0">
          <article *ngFor="let thread of threads(); trackBy: trackByThread"
            class="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-surface-2/60 transition-colors">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-semibold text-primary truncate">{{ thread.fullName || 'User' }}</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  [ngClass]="thread.isActiveNow ? 'bg-success/10 text-success' : 'bg-surface-2 text-secondary'">
                  {{ thread.isActiveNow ? 'Active now' : 'Offline' }}
                </span>
                <span *ngIf="thread.unreadForAgent > 0" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error/10 text-error">
                  {{ thread.unreadForAgent }} unread
                </span>
                <span *ngIf="thread.assignedAgentName" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  Assigned: {{ thread.assignedAgentName }}
                </span>
              </div>
              <p class="text-xs text-secondary mt-1 truncate">{{ thread.email || 'No email' }} • {{ thread.mobile || 'No mobile' }}</p>
              <p class="text-xs text-secondary truncate">Last login: {{ formatDateTime(thread.lastLoginAt) }}</p>
              <p class="text-xs text-muted mt-1 truncate">{{ thread.lastMessagePreview || 'No messages yet' }}</p>
            </div>

            <div class="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                (click)="toggleFavorite(thread)"
                [disabled]="favoriteBusyThreadId() === thread.userId"
                class="px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-60"
                [ngClass]="thread.isFavorite ? 'border-warning text-warning hover:bg-warning/10' : 'border-border text-secondary hover:text-primary'">
                {{ favoriteBusyThreadId() === thread.userId ? 'Saving...' : (thread.isFavorite ? 'Unfavorite' : 'Favorite') }}
              </button>

              <button
                type="button"
                (click)="openDeleteConfirm(thread)"
                [disabled]="deleteBusyThreadId() === thread.userId"
                class="px-3 py-2 rounded-lg border border-error text-error text-xs font-medium hover:bg-error/10 transition-colors disabled:opacity-60">
                {{ deleteBusyThreadId() === thread.userId ? 'Deleting...' : 'Delete Chat' }}
              </button>

              <a [routerLink]="['/agent/support-chats', thread.userId]"
                class="px-4 py-2 rounded-lg border border-border bg-surface text-primary text-sm font-medium no-underline hover:border-primary transition-colors">
                Open Support Chat
              </a>
            </div>
          </article>
        </div>
      </div>
    </div>
  `
})
export class AgentSupportChatsComponent implements OnInit, OnDestroy {
    readonly threads = signal<ChatThreadSummary[]>([]);
    readonly loading = signal<boolean>(true);
    readonly favoriteBusyThreadId = signal<string | null>(null);
    readonly deleteBusyThreadId = signal<string | null>(null);

    searchTerm = '';
    private searchTimeout: any;
    private poller: any;

    constructor(private chatService: ChatService) { }

    ngOnInit(): void {
        this.refresh();
        this.poller = setInterval(() => {
            if (!this.searchTerm.trim()) {
                this.fetchQuietly();
            }
        }, 15000);
    }

    ngOnDestroy(): void {
        if (this.poller) clearInterval(this.poller);
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
    }

    refresh(): void {
        this.loading.set(true);
        this.chatService.loadAgentThreads(this.searchTerm).subscribe((list) => {
            this.threads.set(list);
            this.loading.set(false);
        });
    }

    private fetchQuietly(): void {
        this.chatService.loadAgentThreads(this.searchTerm).subscribe((list) => {
            this.threads.set(list);
        });
    }

    onSearchChange(val: string): void {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.refresh();
        }, 600);
    }

    clearSearch(): void {
        this.searchTerm = '';
        this.refresh();
    }

    toggleFavorite(thread: ChatThreadSummary): void {
        this.favoriteBusyThreadId.set(thread.userId);
        this.chatService.toggleFavoriteThread(thread.userId, !thread.isFavorite).subscribe(() => {
            this.favoriteBusyThreadId.set(null);
            this.fetchQuietly();
        });
    }

    openDeleteConfirm(thread: ChatThreadSummary): void {
        const name = thread.fullName || 'User';
        if (!confirm(`Delete support chat with ${name}? This removes all messages.`)) {
            return;
        }
        this.deleteBusyThreadId.set(thread.userId);
        this.chatService.deleteChatThread(thread.userId).subscribe(() => {
            this.deleteBusyThreadId.set(null);
            this.refresh();
        });
    }

    formatDateTime(val: string | null | undefined): string {
        if (!val) return 'Never';
        return new Date(val).toLocaleString([], {
            month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    }

    trackByThread(_index: number, t: ChatThreadSummary): string {
        return t.userId;
    }
}
