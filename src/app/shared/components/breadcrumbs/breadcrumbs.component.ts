import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subject, filter, startWith, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

interface BreadcrumbItem {
  label: string;
  url: string;
}

interface QuickLink {
  label: string;
  url: string;
  helper: string;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav *ngIf="showWidget()" class="fixed top-[calc(3.85rem+env(safe-area-inset-top))] right-3 z-30">
      <button
        type="button"
        (click)="toggleExpanded()"
        class="inline-flex items-center gap-2 rounded-full border border-border bg-surface/95 backdrop-blur-md px-3 py-1.5 shadow-sm text-xs text-secondary hover:text-primary transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M3 12h13"></path>
          <path d="M3 18h9"></path>
        </svg>
        <span class="hidden sm:inline">Quick Links</span>
        <span class="max-w-[34vw] sm:max-w-[14rem] truncate font-medium text-primary">{{ currentLabel() }}</span>
      </button>

      <section
        *ngIf="expanded()"
        class="mt-2 w-[min(92vw,24rem)] rounded-2xl border border-border bg-surface/95 backdrop-blur-md p-3 shadow-lg space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-muted">Navigation</p>
            <p class="text-sm font-semibold text-primary">{{ roleLabel() }}</p>
          </div>
          <button
            type="button"
            (click)="expanded.set(false)"
            class="w-7 h-7 rounded-full border border-border text-secondary hover:text-primary flex items-center justify-center"
            aria-label="Close quick links">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div>
          <p class="text-[11px] uppercase tracking-wide text-muted mb-1.5">Breadcrumb</p>
          <div class="flex flex-wrap items-center gap-1.5">
            <ng-container *ngFor="let item of items(); let i = index">
              <a
                *ngIf="i < items().length - 1"
                [routerLink]="item.url"
                (click)="expanded.set(false)"
                class="text-xs rounded-full border border-border px-2 py-0.5 text-secondary hover:text-primary no-underline">
                {{ item.label }}
              </a>
              <span *ngIf="i === items().length - 1" class="text-xs rounded-full bg-primary-light/10 px-2 py-0.5 text-primary">
                {{ item.label }}
              </span>
            </ng-container>
          </div>
        </div>

        <div>
          <p class="text-[11px] uppercase tracking-wide text-muted mb-1.5">Quick Access</p>
          <div class="grid grid-cols-1 gap-2 max-h-[46vh] overflow-y-auto pr-1">
            <a
              *ngFor="let link of quickLinks()"
              [routerLink]="link.url"
              (click)="expanded.set(false)"
              class="block rounded-lg border border-border px-3 py-2 no-underline hover:bg-surface-2 transition-colors">
              <p class="text-sm font-medium text-primary leading-tight">{{ link.label }}</p>
              <p class="text-[11px] text-secondary mt-0.5 leading-tight">{{ link.helper }}</p>
            </a>
          </div>
        </div>
      </section>
    </nav>
  `
})
export class BreadcrumbsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  items = signal<BreadcrumbItem[]>([]);
  quickLinks = signal<QuickLink[]>([]);
  expanded = signal<boolean>(false);

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        startWith(null),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.buildNavigationState());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleExpanded(): void {
    this.expanded.update(value => !value);
  }

  showWidget(): boolean {
    return this.items().length > 0 || this.quickLinks().length > 0;
  }

  currentLabel(): string {
    const crumbs = this.items();
    if (!crumbs.length) {
      return 'Navigation';
    }
    return crumbs[crumbs.length - 1]?.label || 'Navigation';
  }

  roleLabel(): string {
    const role = this.authService.currentUserSignal()?.role;
    if (role === 'vendor') {
      return 'Agent Navigation';
    }
    if (role === 'user') {
      return 'User Navigation';
    }
    return 'Public Navigation';
  }

  private buildNavigationState(): void {
    const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', url: '/' }];

    let currentRoute: ActivatedRoute | null = this.activatedRoute.root;
    let currentUrl = '';

    while (currentRoute?.firstChild) {
      currentRoute = currentRoute.firstChild;

      const routeConfig = currentRoute.routeConfig;
      const path = currentRoute.snapshot.url.map(segment => segment.path).join('/');

      if (path) {
        currentUrl += '/' + path;
      }

      if (!routeConfig || routeConfig.path === '**') {
        continue;
      }

      const dataLabel = currentRoute.snapshot.data['breadcrumb'] as string | undefined;
      const label = this.resolveLabel(dataLabel || routeConfig.path, currentRoute.snapshot.params);
      if (!label || label === 'Home') {
        continue;
      }

      breadcrumbs.push({ label, url: currentUrl || '/' });
    }

    this.items.set(breadcrumbs);
    this.quickLinks.set(this.resolveQuickLinks());
    this.expanded.set(false);
  }

  private resolveQuickLinks(): QuickLink[] {
    const role = this.authService.currentUserSignal()?.role;
    if (role === 'vendor') {
      return [
        { label: 'Applicants', url: '/agent', helper: 'Signed-up users and profile review' },
        { label: 'All Chats', url: '/agent/chats', helper: 'Search, favorite, and open chat threads' },
        { label: 'Payments', url: '/agent/payments', helper: 'Global QR/bank config and transaction logs' },
        { label: 'Agreements', url: '/agent/agreements', helper: 'Manage agreement questions and resets' },
        { label: 'Community', url: '/agent/community', helper: 'Community feed moderation' }
      ];
    }

    if (role === 'user') {
      const links: QuickLink[] = [
        { label: 'Dashboard', url: '/dashboard', helper: 'Current status and primary actions' },
        { label: 'Send Payments', url: '/dashboard/send-payments', helper: 'Live payment details and history' },
        { label: 'Chat With Support', url: '/dashboard/support', helper: 'Direct chat with Support Executive' },
        { label: 'Private PMs', url: '/dashboard/messages', helper: 'Community private chat threads' },
        { label: 'Profile Details', url: '/dashboard/profile', helper: 'Profile summary and completion' }
      ];
      if (this.authService.currentUserSignal()?.agreementTabEnabled) {
        links.splice(3, 0, {
          label: 'Agreement',
          url: '/dashboard/agreement',
          helper: 'Answer agreement questions and sign'
        });
      }
      return links;
    }

    return [
      { label: 'Home', url: '/', helper: 'Landing page and featured content' },
      { label: 'Vendors', url: '/partner/coinvault-finance', helper: 'Partner details and serviceability' },
      { label: 'Testimonials', url: '/testimonials-all', helper: 'Customer video testimonials' },
      { label: 'Sign In', url: '/sign-in', helper: 'User login page' },
      { label: 'Vendor Login', url: '/agent-sign-in', helper: 'Agent passcode login' },
      { label: 'Sign Up', url: '/sign-up', helper: 'Create a new user account' }
    ];
  }

  private resolveLabel(rawLabel: string | undefined, params: Record<string, string>): string {
    if (!rawLabel) {
      return '';
    }

    let label = rawLabel;
    Object.keys(params || {}).forEach(key => {
      label = label.replace(`:${key}`, params[key]);
    });

    if (label.includes('/')) {
      label = label.split('/').filter(Boolean).pop() || label;
    }

    return label
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }
}
