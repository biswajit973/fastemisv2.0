import { Component, OnDestroy, OnInit, WritableSignal, computed, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { BreadcrumbsComponent } from './shared/components/breadcrumbs/breadcrumbs.component';

import { GlobalSecurityComponent } from './shared/components/global-security/global-security.component';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';
import { StorageService } from './core/services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, BreadcrumbsComponent, GlobalSecurityComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'fastemis';

  protected readonly welcomeLineOne =
    'Hey 👋 Welcome to Fastemis - the world\'s fastest home-based Buy Now, Pay Later service.';
  protected readonly welcomeLineTwo = 'Please wait while we detect your country...';

  protected readonly showOverlay = signal(false);
  protected readonly overlayClosing = signal(false);
  protected readonly typedLineOne = signal('');
  protected readonly typedLineTwo = signal('');
  protected readonly countryDetected = signal(false);
  protected readonly isTyping = signal(false);
  protected readonly introActive = computed(() => this.showOverlay());
  protected readonly resetBusy = signal(false);

  private readonly sessionKey = 'fastemis_welcome_overlay_seen_v1';
  private readonly timeouts: Array<ReturnType<typeof setTimeout>> = [];
  private readonly intervals: Array<ReturnType<typeof setInterval>> = [];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private storageService: StorageService
  ) { }

  ngOnInit(): void {
    if (!this.shouldShowOverlay()) {
      return;
    }

    this.startOverlayFlow();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private shouldShowOverlay(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.sessionStorage.getItem(this.sessionKey) !== '1';
  }

  private startOverlayFlow(): void {
    this.showOverlay.set(true);
    this.isTyping.set(true);
    this.playSoftAmbientTone();

    this.typeLine(this.typedLineOne, this.welcomeLineOne, 20, 120);
    this.typeLine(this.typedLineTwo, this.welcomeLineTwo, 22, 1680);

    this.timeouts.push(
      setTimeout(() => {
        this.isTyping.set(false);
      }, 3320)
    );

    this.timeouts.push(
      setTimeout(() => {
        this.countryDetected.set(true);
      }, 2800)
    );

    this.timeouts.push(
      setTimeout(() => {
        this.closeOverlay();
      }, 4900)
    );
  }

  private closeOverlay(): void {
    this.overlayClosing.set(true);
    this.timeouts.push(
      setTimeout(() => {
        this.overlayClosing.set(false);
        this.showOverlay.set(false);
        this.persistOverlaySeen();
      }, 560)
    );
  }

  private typeLine(
    target: WritableSignal<string>,
    text: string,
    speedMs: number,
    startDelayMs: number
  ): void {
    const startTimer = setTimeout(() => {
      let index = 0;
      const typingTimer = setInterval(() => {
        index += 1;
        target.set(text.slice(0, index));
        if (index >= text.length) {
          clearInterval(typingTimer);
        }
      }, speedMs);
      this.intervals.push(typingTimer);
    }, startDelayMs);

    this.timeouts.push(startTimer);
  }

  private playSoftAmbientTone(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const audioContextType =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audioContextType) {
        return;
      }

      const audioContext = new audioContextType();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(196, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.007, audioContext.currentTime + 0.35);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1.35);

      this.timeouts.push(
        setTimeout(() => {
          void audioContext.close();
        }, 1700)
      );
    } catch {
      // Intentionally silent fallback if browser blocks autoplay audio.
    }
  }

  private persistOverlaySeen(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.setItem(this.sessionKey, '1');
  }

  private clearTimers(): void {
    this.timeouts.forEach(timer => clearTimeout(timer));
    this.intervals.forEach(timer => clearInterval(timer));
    this.timeouts.length = 0;
    this.intervals.length = 0;
  }

  protected async clearBrowserSessionData(): Promise<void> {
    if (this.resetBusy()) {
      return;
    }

    const shouldProceed = typeof window === 'undefined'
      ? false
      : window.confirm('Clear session, cookies and cache now?');
    if (!shouldProceed) {
      return;
    }

    this.resetBusy.set(true);

    try {
      this.authService.logout();
      this.storageService.clear();

      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }

      if (typeof document !== 'undefined') {
        const cookies = document.cookie ? document.cookie.split(';') : [];
        for (const entry of cookies) {
          const name = entry.split('=')[0]?.trim();
          if (!name) continue;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        }
      }

      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        const indexedDbApi = window.indexedDB as IDBFactory & {
          databases?: () => Promise<Array<{ name?: string }>>;
        };
        if (typeof indexedDbApi.databases === 'function') {
          const dbs = await indexedDbApi.databases();
          for (const db of dbs) {
            if (db?.name) {
              try {
                indexedDbApi.deleteDatabase(db.name);
              } catch {
                // best-effort cleanup only
              }
            }
          }
        }
      }

      this.notificationService.success('Session, cookies and cache cleared. Reloading...');

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }, 250);
    } catch {
      this.notificationService.error('Could not fully clear browser data. Please try again.');
    } finally {
      this.resetBusy.set(false);
    }
  }
}
