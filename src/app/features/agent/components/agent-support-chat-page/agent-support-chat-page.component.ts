import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgentChatComponent } from '../agent-chat/agent-chat.component';
import { ChatService } from '../../../../core/services/chat.service';

@Component({
  selector: 'app-agent-support-chat-page',
  standalone: true,
  imports: [CommonModule, RouterLink, AgentChatComponent],
  template: `
    <div class="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-6" *ngIf="ready(); else loadingState">
      <div class="mb-3">
        <a routerLink="/agent/support-chats" class="text-sm text-secondary hover:text-primary no-underline inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Support Chats
        </a>
      </div>

      <app-agent-chat
        [userId]="userId()"
        [userName]="userName()"
        [lastLoginAt]="lastLoginAt()"
        [fullPage]="true">
      </app-agent-chat>
    </div>

    <ng-template #loadingState>
      <div class="px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto py-16 text-center">
        <div class="w-8 h-8 rounded-full border-2 border-surface-3 border-t-primary animate-spin mx-auto mb-4"></div>
        <p class="text-secondary">Loading support chat...</p>
      </div>
    </ng-template>
  `
})
export class AgentSupportChatPageComponent implements OnInit {
  readonly userId = signal<string>('');
  readonly userName = signal<string>('User');
  readonly lastLoginAt = signal<string>('');
  readonly ready = signal<boolean>(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService
  ) {}

  ngOnInit(): void {
    const userId = String(this.route.snapshot.paramMap.get('userId') || '').trim();
    if (!userId) {
      this.router.navigate(['/agent/support-chats']);
      return;
    }

    this.userId.set(userId);
    this.chatService.loadAgentThreads().subscribe((threads) => {
      const thread = threads.find((item) => item.userId === userId) || null;
      if (!thread) {
        this.router.navigate(['/agent/support-chats']);
        return;
      }

      this.userName.set(thread.fullName || 'User');
      this.lastLoginAt.set(thread.lastLoginAt || '');
      this.ready.set(true);
    });
  }
}
