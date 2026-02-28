import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { GhostChatService } from '../../../../core/services/ghost-chat.service';
import { ChatService } from '../../../../core/services/chat.service';

@Component({
  selector: 'app-dashboard-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Top Nav -->
    <nav class="bg-surface border-b border-border h-14 md:h-16 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40 bg-opacity-95 backdrop-blur-md">
      <div class="flex items-center gap-2">
        <a routerLink="/" class="flex items-center gap-2 font-bold text-primary tracking-tight">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          FastEMIs
        </a>
      </div>
      <div class="relative">
        <button
          (click)="toggleProfileMenu()"
          class="flex items-center gap-3 p-1 rounded-xl hover:bg-surface-2 transition-colors">
          <div class="hidden sm:block text-right">
            <div class="text-sm font-bold leading-tight" [ngClass]="isAgent() ? 'text-accent' : 'text-primary'">
              {{ isAgent() ? 'Agent' : 'User' }}: {{ authService.currentUserSignal()?.fullName || 'User' }}
            </div>
            <div class="text-xs text-muted">{{ isAgent() ? 'Vendor ID:' : 'User ID:' }} {{ authService.currentUserSignal()?.id || '-' }}</div>
          </div>
          <div class="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold font-display shadow-sm border"
               [ngClass]="isAgent() ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-primary-light/20 text-primary border-primary/20'">
            {{ getInitials() }}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary hidden sm:block">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <div
          *ngIf="profileMenuOpen"
          class="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div class="block sm:hidden px-4 py-3 border-b border-border bg-surface-2">
            <div class="text-sm font-bold text-primary">{{ authService.currentUserSignal()?.fullName || 'User' }}</div>
            <div class="text-xs text-secondary mt-0.5">{{ authService.currentUserSignal()?.id }}</div>
          </div>
          <a routerLink="/dashboard/profile" (click)="closeMenu()" class="block px-4 py-3 text-sm text-primary hover:bg-surface-2 no-underline transition-colors">
            Profile Settings
          </a>
          <button
            (click)="logout()"
            class="w-full text-left px-4 py-3 text-sm text-error hover:bg-error/5 transition-colors border-t border-border font-medium">
            Sign Out
          </button>
        </div>
      </div>
    </nav>

    <!-- Floating Bottom Nav (Mobile) -->
    <div class="md:hidden fixed bottom-6 left-4 right-4 h-[72px] bg-surface/85 backdrop-blur-2xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl z-50 flex justify-around items-center px-2 animate-fade-in">
      
      <a routerLink="/dashboard" routerLinkActive="!text-white bg-primary shadow-md transform scale-105 pointer-events-none" [routerLinkActiveOptions]="{exact: true}" 
         class="flex flex-col items-center justify-center w-[16%] h-[60px] rounded-2xl text-secondary hover:text-primary transition-all duration-300 active:scale-95 group">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="mb-1 transition-transform duration-300 group-hover:-translate-y-1"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span class="text-[9px] font-semibold truncate w-full text-center px-0.5 tracking-tight group-hover:opacity-100">Overview</span>
      </a>

      <a routerLink="/dashboard/support" routerLinkActive="!text-white bg-primary shadow-md transform scale-105 pointer-events-none" 
         class="flex flex-col items-center justify-center w-[16%] h-[60px] rounded-2xl text-secondary hover:text-primary transition-all duration-300 active:scale-95 group relative">
        <span *ngIf="supportUnreadCount() > 0" class="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full border-2 border-surface bg-error text-white text-[10px] font-bold leading-[14px] flex items-center justify-center animate-pulse">
          {{ supportUnreadCount() > 99 ? '99+' : supportUnreadCount() }}
        </span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="mb-1 transition-transform duration-300 group-hover:-translate-y-1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        <span class="text-[9px] font-semibold truncate w-full text-center px-0.5 tracking-tight group-hover:opacity-100">Support</span>
      </a>

      <a *ngIf="isAgreementEnabled()" routerLink="/dashboard/agreement" routerLinkActive="!text-white bg-primary shadow-md transform scale-105 pointer-events-none"
         class="flex flex-col items-center justify-center w-[16%] h-[60px] rounded-2xl text-secondary hover:text-primary transition-all duration-300 active:scale-95 group">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="mb-1 transition-transform duration-300 group-hover:-translate-y-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 14h6"></path><path d="M9 18h6"></path></svg>
        <span class="text-[9px] font-semibold truncate w-full text-center px-0.5 tracking-tight group-hover:opacity-100">Sign</span>
      </a>

      <a routerLink="/dashboard/send-payments" routerLinkActive="!text-white bg-primary shadow-md transform scale-105 pointer-events-none"
         class="flex flex-col items-center justify-center w-[16%] h-[60px] rounded-2xl text-secondary hover:text-primary transition-all duration-300 active:scale-95 group">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="mb-1 transition-transform duration-300 group-hover:-translate-y-1"><path d="M12 1v22"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        <span class="text-[9px] font-semibold truncate w-full text-center px-0.5 tracking-tight group-hover:opacity-100">Pay</span>
      </a>

      <a routerLink="/dashboard/community" routerLinkActive="!text-white bg-primary shadow-md transform scale-105 pointer-events-none" 
         class="flex flex-col items-center justify-center w-[16%] h-[60px] rounded-2xl text-secondary hover:text-primary transition-all duration-300 active:scale-95 group">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="mb-1 transition-transform duration-300 group-hover:-translate-y-1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <span class="text-[9px] font-semibold truncate w-full text-center px-0.5 tracking-tight group-hover:opacity-100">Forum</span>
      </a>

      <a routerLink="/dashboard/messages" routerLinkActive="!text-white bg-primary shadow-md transform scale-105 pointer-events-none" [routerLinkActiveOptions]="{exact: true}"
         class="flex flex-col items-center justify-center w-[16%] h-[60px] rounded-2xl text-secondary hover:text-primary transition-all duration-300 active:scale-95 group relative">
        <span *ngIf="privatePmUnreadCount() > 0" class="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full border-2 border-surface bg-error text-white text-[10px] font-bold leading-[14px] flex items-center justify-center animate-pulse">
          {{ privatePmUnreadCount() > 99 ? '99+' : privatePmUnreadCount() }}
        </span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="mb-1 transition-transform duration-300 group-hover:-translate-y-1"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        <span class="text-[9px] font-semibold truncate w-full text-center px-0.5 tracking-tight group-hover:opacity-100">PMs</span>
      </a>

    </div>

    <!-- Side Nav (Desktop) -->
    <aside class="hidden md:flex fixed left-0 top-16 bottom-0 w-64 md:w-[300px] bg-surface/95 backdrop-blur-md border-r border-border pt-10 pb-20 px-6 z-30 flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      
      <div class="px-2 pb-6">
        <p class="text-xs font-bold text-muted uppercase tracking-widest">Main Menu</p>
      </div>

      <nav class="space-y-2.5 flex-1 relative w-full flex flex-col">
        
        <a routerLink="/dashboard" routerLinkActive="!bg-primary hover:!bg-primary-dark !text-white shadow-md transform -translate-y-0.5" [routerLinkActiveOptions]="{exact: true}"
           class="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-secondary hover:bg-black hover:text-white transition-all duration-300 border border-transparent shadow-sm">
          <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-2 group-hover:bg-white/10 overflow-hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </div>
          <span class="tracking-tight">User Dashboard</span>
        </a>
        
        <a routerLink="/dashboard/support" routerLinkActive="!bg-primary hover:!bg-primary-dark !text-white shadow-md transform -translate-y-0.5"
           class="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-secondary hover:bg-black hover:text-white transition-all duration-300 border border-transparent shadow-sm">
          <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-2 group-hover:bg-white/10 overflow-hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          </div>
          <span class="tracking-tight flex-1">Chat With Support</span>
          <span *ngIf="supportUnreadCount() > 0" class="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shrink-0">
            {{ supportUnreadCount() > 99 ? '99+' : supportUnreadCount() }}
          </span>
        </a>

        <a *ngIf="isAgreementEnabled()" routerLink="/dashboard/agreement" routerLinkActive="!bg-primary hover:!bg-primary-dark !text-white shadow-md transform -translate-y-0.5"
           class="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-secondary hover:bg-black hover:text-white transition-all duration-300 border border-transparent shadow-sm">
          <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-2 group-hover:bg-white/10 overflow-hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 14h6"></path><path d="M9 18h6"></path></svg>
          </div>
          <span class="tracking-tight">Agreements</span>
        </a>

        <a routerLink="/dashboard/send-payments" routerLinkActive="!bg-primary hover:!bg-primary-dark !text-white shadow-md transform -translate-y-0.5"
           class="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-secondary hover:bg-black hover:text-white transition-all duration-300 border border-transparent shadow-sm">
          <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-2 group-hover:bg-white/10 overflow-hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 1v22"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <span class="tracking-tight">Payments</span>
        </a>

        <a routerLink="/dashboard/community" routerLinkActive="!bg-primary hover:!bg-primary-dark !text-white shadow-md transform -translate-y-0.5"
           class="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-secondary hover:bg-black hover:text-white transition-all duration-300 border border-transparent shadow-sm">
          <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-2 group-hover:bg-white/10 overflow-hidden">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <span class="tracking-tight">Community Chats</span>
        </a>

        <a routerLink="/dashboard/messages" routerLinkActive="!bg-primary hover:!bg-primary-dark !text-white shadow-md transform -translate-y-0.5" [routerLinkActiveOptions]="{exact: true}"
           class="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-secondary hover:bg-black hover:text-white transition-all duration-300 justify-between border border-transparent shadow-sm">
          <div class="flex items-center gap-4 overflow-hidden">
            <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-2 group-hover:bg-white/10 overflow-hidden shrink-0 relative">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </div>
            <span class="tracking-tight truncate flex-1">Private Community PMs</span>
          </div>
          <span *ngIf="privatePmUnreadCount() > 0" class="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shrink-0">
            {{ privatePmUnreadCount() > 99 ? '99+' : privatePmUnreadCount() }} New
          </span>
        </a>
      </nav>
    </aside>
  `
})
export class DashboardNavComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private ghostChatService = inject(GhostChatService);
  private chatService = inject(ChatService);
  private router = inject(Router);

  profileMenuOpen = false;
  mobileMenuOpen = false;
  supportUnreadCount = signal<number>(0);
  privatePmUnreadCount = signal<number>(0);
  private unreadPoller: number | null = null;

  ngOnInit(): void {
    const user = this.authService.currentUserSignal();
    if (!user || user.role !== 'user') {
      this.supportUnreadCount.set(0);
      this.privatePmUnreadCount.set(0);
      return;
    }

    this.refreshUnread();
    this.unreadPoller = window.setInterval(() => this.refreshUnread(), 9000);
    this.authService.getBackendUserProfile().subscribe();
  }

  ngOnDestroy(): void {
    if (this.unreadPoller !== null) {
      window.clearInterval(this.unreadPoller);
      this.unreadPoller = null;
    }
  }

  isRouteActive(url: string, exact: boolean = false): boolean {
    return this.router.isActive(url, {
      paths: exact ? 'exact' : 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
    });
  }

  isAgent(): boolean {
    return this.authService.currentUserSignal()?.role === 'vendor';
  }

  isAgreementEnabled(): boolean {
    return !!this.authService.currentUserSignal()?.agreementTabEnabled;
  }

  getInitials(): string {
    const name = this.authService.currentUserSignal()?.fullName || 'User';
    if (this.isAgent()) return 'AC'; // Acme Corp default, or custom
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  toggleProfileMenu() {
    this.profileMenuOpen = !this.profileMenuOpen;
    if (this.profileMenuOpen) this.mobileMenuOpen = false;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) this.profileMenuOpen = false;
  }

  closeMenu() {
    this.profileMenuOpen = false;
    this.mobileMenuOpen = false;
  }

  logout() {
    this.authService.logout();
    this.profileMenuOpen = false;
    this.router.navigate(['/']);
  }

  private refreshUnread(_userId?: string): void {
    this.chatService.loadUserThread().subscribe((thread) => {
      this.supportUnreadCount.set(Number(thread?.unreadForUser || 0));
    });

    this.ghostChatService.loadUserThreads().subscribe((threads) => {
      const unreadTotal = threads.reduce((sum, thread) => sum + Number(thread.unread_for_user || 0), 0);
      this.privatePmUnreadCount.set(unreadTotal);
    });
  }
}
