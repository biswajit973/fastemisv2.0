import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatMessage, ChatService, ChatThreadSummary } from '../../../../core/services/chat.service';

@Component({
  selector: 'app-support-chat',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  styles: [`
    .chat-font {
      font-family: "Google Sans", "Segoe UI", sans-serif;
    }
  `],
  template: `
    <div class="flex flex-col h-screen chat-font bg-surface-2">
      <header class="border-b border-border h-16 flex items-center justify-between px-4 shrink-0 sticky top-0 z-20 gap-3 bg-surface/85 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <div class="flex items-center gap-3 min-w-0">
          <a routerLink="/dashboard" class="text-secondary hover:text-primary transition-standard shrink-0" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </a>
          <div class="min-w-0">
            <h2 class="font-extrabold text-primary leading-tight truncate">Chat With Support</h2>
            <p class="text-xs font-medium text-secondary truncate">Direct support chat with Support Executive.</p>
          </div>
        </div>
        <button type="button" (click)="showMediaGallery.set(!showMediaGallery())" class="px-2.5 py-1 rounded border border-border text-xs text-primary">
          Media ({{ sharedMedia().length }})
        </button>
      </header>

      <main class="flex-1 min-h-0 flex flex-col">
        <div class="px-4 py-3 border-b border-border bg-white flex items-center justify-between gap-2" *ngIf="thread() as currentThread">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-primary truncate">{{ currentThread.assignedAgentName || 'Support Executive' }}</h3>
            <p class="text-[11px] text-secondary truncate">
              {{ currentThread.isActiveNow ? 'Active now' : 'Offline' }}
              <span *ngIf="currentThread.lastLoginAt"> • Last login: {{ formatDateTime(currentThread.lastLoginAt) }}</span>
            </p>
          </div>
          <button
            type="button"
            (click)="refresh(true)"
            [disabled]="loading()"
            class="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-primary hover:border-primary transition-colors disabled:opacity-60">
            {{ loading() ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <div *ngIf="loading() && messagesState().length === 0" class="flex-1 flex items-center justify-center text-secondary text-sm">
          Loading support chat...
        </div>

        <div *ngIf="!loading() && !thread()" class="flex-1 flex items-center justify-center text-secondary text-sm px-4 text-center">
          Support thread not ready yet. Please refresh in a moment.
        </div>

        <div *ngIf="thread()" class="flex-1 min-h-0 relative">
          <div *ngIf="!showMediaGallery()" class="h-full overflow-y-auto p-4 space-y-3" #scrollContainer>
            <div *ngFor="let msg of messagesState()" class="flex flex-col max-w-[85%]"
              [ngClass]="{
                'self-end items-end': msg.sender === 'user',
                'self-start items-start': msg.sender === 'agent' || msg.sender === 'system',
                'mx-auto text-center !max-w-full': msg.sender === 'system'
              }">
              <ng-container *ngIf="msg.sender !== 'system'">
                <div class="text-[10px] text-muted mb-1" *ngIf="msg.sender === 'agent'">{{ msg.senderName || 'Support Executive' }}</div>
                <div class="p-3 rounded-2xl shadow-sm text-sm border"
                  [ngClass]="msg.sender === 'user' ? 'bg-[#d9fdd3] text-[#111b21] border-[#bfe7b7] rounded-tr-sm' : 'bg-white border-border text-primary rounded-tl-sm'">
                  <span *ngIf="msg.type === 'text'" class="whitespace-pre-wrap">{{ msg.content }}</span>
                  <div *ngIf="msg.type === 'media'" class="space-y-2">
                    <img *ngIf="msg.mediaUrl && isImage(msg.mediaName)" [src]="msg.mediaUrl" class="rounded max-h-56 object-cover">
                    <video *ngIf="msg.mediaUrl && isVideo(msg.mediaName)" [src]="msg.mediaUrl" controls class="rounded max-h-56 bg-black"></video>
                    <div *ngIf="!msg.mediaUrl || (!isImage(msg.mediaName) && !isVideo(msg.mediaName))" class="text-xs bg-black/10 rounded px-2 py-1">
                      {{ msg.mediaName || 'Attachment' }}
                    </div>
                    <button type="button" (click)="openMediaPreview(msg)" class="inline-flex items-center gap-1 rounded-full border border-current/30 px-2 py-1 text-[10px]">
                      Preview
                    </button>
                  </div>
                </div>
                <p class="text-[10px] text-muted mt-1">{{ formatDateTime(msg.timestamp) }}</p>
              </ng-container>

              <ng-container *ngIf="msg.sender === 'system'">
                <div class="bg-surface-3 border border-border text-secondary text-xs px-3 py-2 rounded-lg">{{ msg.content }}</div>
              </ng-container>
            </div>
          </div>

          <div *ngIf="showMediaGallery()" class="h-full overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white">
            <div *ngIf="sharedMedia().length === 0" class="col-span-full py-10 text-center text-secondary text-sm">No shared media yet.</div>
            <article *ngFor="let media of sharedMedia()" class="border border-border rounded-xl overflow-hidden bg-surface-2">
              <img *ngIf="media.mediaUrl && isImage(media.mediaName)" [src]="media.mediaUrl" class="w-full h-40 object-cover">
              <video *ngIf="media.mediaUrl && isVideo(media.mediaName)" [src]="media.mediaUrl" class="w-full h-40 object-cover bg-black" controls></video>
              <div *ngIf="!media.mediaUrl || (!isImage(media.mediaName) && !isVideo(media.mediaName))" class="h-40 flex items-center justify-center text-secondary text-xs">{{ media.mediaName || 'Attachment' }}</div>
              <div class="px-3 py-2 border-t border-border">
                <p class="text-[11px] text-primary truncate">{{ media.mediaName || 'Attachment' }}</p>
                <p class="text-[10px] text-secondary">{{ formatDateTime(media.timestamp) }}</p>
              </div>
            </article>
          </div>
        </div>

        <footer *ngIf="thread()" class="bg-white/95 border-t border-border p-3 flex items-center gap-2 shrink-0">
          <input type="file" #fileInput class="hidden" (change)="onFileSelected($event)" accept="image/*,video/*,.pdf,.txt">
          <button type="button" (click)="fileInput.click()" class="w-10 h-10 rounded-full text-secondary hover:bg-surface-3 flex items-center justify-center shrink-0" title="Share media">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>

          <div class="flex-1 bg-surface-2 rounded-full border border-border px-4 py-2">
            <input type="text" [(ngModel)]="newMessage" (keyup.enter)="sendMessage()" placeholder="Type your message..." class="w-full bg-transparent border-none outline-none text-sm text-primary placeholder-muted" />
          </div>

          <button type="button" (click)="sendMessage()" [disabled]="!newMessage.trim()" class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            [ngClass]="newMessage.trim() ? 'bg-[#ff8f00] text-white' : 'bg-surface-3 text-muted'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </footer>
      </main>
    </div>

    <div *ngIf="previewMedia()" class="fixed inset-0 z-[96] bg-black/85 p-4 flex flex-col">
      <div class="flex items-center justify-between text-white mb-3">
        <div>
          <p class="text-sm font-medium">{{ previewMedia()?.mediaName || 'Attachment' }}</p>
          <p class="text-xs text-white/70">{{ formatDateTime(previewMedia()?.timestamp || '') }}</p>
        </div>
        <button type="button" (click)="closeMediaPreview()" class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">X</button>
      </div>
      <div class="flex-1 rounded-xl border border-white/20 bg-black/30 p-2 flex items-center justify-center overflow-hidden">
        <img *ngIf="previewMedia()?.mediaUrl && isImage(previewMedia()?.mediaName)" [src]="previewMedia()?.mediaUrl || ''" class="max-h-full max-w-full object-contain rounded" alt="preview" />
        <video *ngIf="previewMedia()?.mediaUrl && isVideo(previewMedia()?.mediaName)" [src]="previewMedia()?.mediaUrl || ''" controls autoplay class="max-h-full max-w-full rounded"></video>
      </div>
    </div>
  `
})
export class SupportChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef;

  readonly thread = signal<ChatThreadSummary | null>(null);
  readonly messagesState = signal<ChatMessage[]>([]);
  readonly loading = signal<boolean>(false);
  readonly showMediaGallery = signal<boolean>(false);
  readonly previewMedia = signal<ChatMessage | null>(null);

  newMessage = '';
  private threadPoller: number | null = null;
  private messagesPoller: number | null = null;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.refresh(true);
    this.threadPoller = window.setInterval(() => this.refresh(false), 10000);
    this.messagesPoller = window.setInterval(() => this.refreshMessages(true), 6000);
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    if (this.threadPoller !== null) {
      window.clearInterval(this.threadPoller);
      this.threadPoller = null;
    }
    if (this.messagesPoller !== null) {
      window.clearInterval(this.messagesPoller);
      this.messagesPoller = null;
    }
  }

  refresh(forceFullMessages: boolean): void {
    this.loading.set(true);
    this.chatService.loadUserThread().subscribe((thread) => {
      this.thread.set(thread);
      this.loading.set(false);
      if (thread?.userId) {
        this.refreshMessages(!forceFullMessages);
      } else {
        this.messagesState.set([]);
      }
    });
  }

  refreshMessages(incremental: boolean): void {
    const current = this.thread();
    if (!current?.userId) {
      return;
    }

    this.chatService.fetchMessages(current.userId, { forceFull: !incremental }).subscribe((messages) => {
      this.messagesState.set(messages);
    });
  }

  sendMessage(): void {
    const current = this.thread();
    const text = this.newMessage.trim();
    if (!current?.userId || !text) {
      return;
    }

    this.newMessage = '';
    this.chatService.sendTextMessage(current.userId, text).subscribe(() => {
      this.refreshMessages(true);
      this.refresh(false);
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const current = this.thread();
    if (!file || !current?.userId) {
      return;
    }

    this.chatService.sendMediaMessage(current.userId, file).subscribe(() => {
      this.refreshMessages(true);
      this.refresh(false);
      input.value = '';
    });
  }

  sharedMedia(): ChatMessage[] {
    return this.messagesState().filter((message) => message.type === 'media');
  }

  openMediaPreview(message: ChatMessage): void {
    this.previewMedia.set(message);
  }

  closeMediaPreview(): void {
    this.previewMedia.set(null);
  }

  isImage(name?: string): boolean {
    return !!name && /(png|jpg|jpeg|gif|webp)$/i.test(name);
  }

  isVideo(name?: string): boolean {
    return !!name && /(mp4|webm|ogg|mov)$/i.test(name);
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return '-';
    }
    return date.toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private scrollToBottom(): void {
    if (!this.scrollContainer) {
      return;
    }
    const element = this.scrollContainer.nativeElement as HTMLElement;
    element.scrollTop = element.scrollHeight;
  }
}
