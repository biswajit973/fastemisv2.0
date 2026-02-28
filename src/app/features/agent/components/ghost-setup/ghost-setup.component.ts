import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommunityPersona, CommunityService } from '../../../../core/services/community.service';

@Component({
   selector: 'app-ghost-setup',
   standalone: true,
   imports: [CommonModule, FormsModule, RouterLink],
   template: `
    <div class="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto pb-8">
      <header class="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-2">
             <a routerLink="/agent" class="text-secondary hover:text-primary no-underline text-sm flex items-center gap-1">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
               Back
             </a>
          </div>
          <h1 class="text-2xl font-bold text-primary">Ghost Member Setup</h1>
          <p class="text-sm text-secondary">Manage community identities and global header settings.</p>
        </div>
        <div class="flex items-center gap-2">
           <a routerLink="/agent/community" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors no-underline">
              Open Community Chat
           </a>
        </div>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[360px_1fr] gap-6">
         <!-- Left Column: Settings & Create -->
         <div class="space-y-6">
            
            <section class="bg-surface border border-border rounded-xl p-5 shadow-sm">
               <h2 class="text-[13px] uppercase tracking-wider font-bold text-secondary mb-3">Community Header Settings</h2>
               <div class="space-y-3">
                  <div>
                     <label class="block text-xs font-semibold text-primary mb-1">Community Title</label>
                     <input [(ngModel)]="communityTitleDraft" type="text" placeholder="community chat." class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  </div>
                  <div>
                     <label class="block text-xs font-semibold text-primary mb-1">Active Members Count (Fake)</label>
                     <input [(ngModel)]="activeMembersDraft" type="number" min="1" class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  </div>
                  <button type="button" (click)="saveCommunitySettings()" [disabled]="settingsBusy()" class="w-full py-2 bg-primary text-white rounded text-sm font-medium disabled:opacity-50">
                     {{ settingsBusy() ? 'Saving...' : 'Save Settings' }}
                  </button>
               </div>
            </section>

            <section class="bg-surface border border-border rounded-xl p-5 shadow-sm">
               <h2 class="text-[13px] uppercase tracking-wider font-bold text-secondary mb-3">Global Safety Rules</h2>
               <ul class="text-sm text-secondary space-y-1 pl-4 list-disc">
                 <li *ngFor="let rule of safetyRules()">{{ rule }}</li>
                 <li *ngIf="safetyRules().length === 0">No specific rules loaded.</li>
               </ul>
            </section>

         </div>

         <!-- Right Column: Ghost Member Management -->
         <div class="space-y-6">
            <section class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px]">
               <div class="p-4 border-b border-border flex items-center justify-between gap-4 bg-surface-2">
                  <h2 class="text-[13px] uppercase tracking-wider font-bold text-primary">Ghost Identities Database</h2>
                  <button type="button" (click)="loadGhostMembers()" [disabled]="loadingMembers()" class="text-xs text-primary hover:text-primary-light font-medium">
                     {{ loadingMembers() ? 'Refreshing...' : 'Refresh List' }}
                  </button>
               </div>
               
               <div class="p-4 border-b border-border bg-surface">
                 <input [(ngModel)]="memberSearch" (ngModelChange)="onGhostSearchChange($event)" type="text" placeholder="Search identities by name, id or tag..." class="w-full rounded bg-surface-2 border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-primary">
               </div>

               <div class="flex-1 overflow-y-auto divide-y divide-border bg-surface">
                  <div *ngIf="ghostMembers().length === 0 && !loadingMembers()" class="p-8 text-center text-secondary text-sm">
                     No identities found. Create one below to get started.
                  </div>
                  
                  <div *ngFor="let member of ghostMembers(); trackBy: trackByGhostMember" class="p-4 hover:bg-surface-2 group flex flex-col sm:flex-row sm:items-start gap-3 transition-colors">
                     
                     <div class="w-10 h-10 rounded-full bg-primary-light/20 text-primary border border-primary/20 flex flex-shrink-0 items-center justify-center font-bold font-display shadow-sm">
                       {{ avatarLabel(member.display_name) }}
                     </div>
                     
                     <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-0.5">
                           <h3 class="font-bold text-primary text-sm truncate">{{ member.display_name }}</h3>
                           <div class="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button type="button" (click)="pickMemberForEdit(member)" class="text-[11px] text-primary hover:underline font-medium">Edit</button>
                           </div>
                        </div>
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                           <span class="inline-flex bg-surface-3 border border-border text-secondary text-[10px] px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]" title="Ghost ID">{{ member.ghost_id }}</span>
                           <span class="inline-flex bg-accent/10 border border-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{{ member.identity_tag || 'general' }}</span>
                        </div>
                        <p class="text-[12px] text-secondary line-clamp-2 leading-relaxed">{{ member.info || 'No external info provided.' }}</p>
                     </div>
                  </div>
               </div>
            </section>

            <section class="bg-surface border border-border rounded-xl p-5 shadow-sm" [ngClass]="editGhostMemberId() ? 'ring-2 ring-primary ring-offset-2' : ''">
               <div class="flex items-center justify-between mb-4">
                  <h2 class="text-[13px] uppercase tracking-wider font-bold text-primary">
                     {{ editGhostMemberId() ? 'Edit Identity: ' + editDisplayName() : 'Create New Identity' }}
                  </h2>
                  <button *ngIf="editGhostMemberId()" type="button" (click)="clearEditGhostMember()" class="text-[11px] font-bold text-secondary hover:text-primary uppercase tracking-wider">Cancel Edit</button>
               </div>
               
               <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                     <label class="block text-xs font-semibold text-primary mb-1">Display Name *</label>
                     <input *ngIf="!editGhostMemberId()" [ngModel]="newDisplayName()" (ngModelChange)="newDisplayName.set($event)" type="text" placeholder="E.g. FastEMIs Support" class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary">
                     <input *ngIf="editGhostMemberId()" [ngModel]="editDisplayName()" (ngModelChange)="editDisplayName.set($event)" type="text" placeholder="E.g. FastEMIs Support" class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  </div>
                  <div>
                     <label class="block text-xs font-semibold text-primary mb-1">Ghost ID (Unique) *</label>
                     <input *ngIf="!editGhostMemberId()" [ngModel]="newGhostId()" (ngModelChange)="newGhostId.set($event)" (blur)="normalizeNewGhostId()" type="text" placeholder="E.g. fastemis_sup_01" class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary">
                     <input *ngIf="editGhostMemberId()" [ngModel]="editGhostId()" readonly type="text" class="w-full rounded bg-surface-3 border border-border px-3 py-2 text-sm font-mono text-muted cursor-not-allowed">
                     <p *ngIf="!editGhostMemberId()" class="mt-1 text-[11px] text-secondary">Allowed format: letters, numbers, <span class="font-mono">_</span>, <span class="font-mono">-</span> (3-40 chars)</p>
                  </div>
               </div>

               <div class="mb-4">
                  <label class="block text-xs font-semibold text-primary mb-1">Identity Tag *</label>
                  <input *ngIf="!editGhostMemberId()" [ngModel]="newIdentityTag()" (ngModelChange)="newIdentityTag.set($event)" type="text" placeholder="E.g. staff, customer, verified" class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  <input *ngIf="editGhostMemberId()" [ngModel]="editIdentityTag()" (ngModelChange)="editIdentityTag.set($event)" type="text" placeholder="E.g. staff, customer, verified" class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary">
               </div>
               
               <div class="mb-5">
                  <label class="block text-xs font-semibold text-primary mb-1">User-Facing Info</label>
                  <textarea *ngIf="!editGhostMemberId()" [ngModel]="newInfo()" (ngModelChange)="newInfo.set($event)" rows="2" maxlength="220" placeholder="A short blurb shown beneath their name in chat (max 220 chars)." class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"></textarea>
                  <textarea *ngIf="editGhostMemberId()" [ngModel]="editInfo()" (ngModelChange)="editInfo.set($event)" rows="2" maxlength="220" placeholder="A short blurb shown beneath their name in chat (max 220 chars)." class="w-full rounded bg-surface-2 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"></textarea>
               </div>

               <div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <div *ngIf="actionError()" class="mr-auto text-[12px] text-error bg-error/10 border border-error/30 rounded px-3 py-2 max-w-[360px]">
                    {{ actionError() }}
                  </div>

                  <button *ngIf="editGhostMemberId()" type="button" (click)="deleteGhostMember()" [disabled]="memberActionBusy()" class="text-sm text-error hover:text-red-700 font-medium disabled:opacity-50">
                     Delete Identity
                  </button>

                  <button *ngIf="!editGhostMemberId()" type="button" (click)="createGhostMember()" [disabled]="!canCreateGhostMember() || memberActionBusy()" class="px-6 py-2 bg-primary text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-primary-light transition-colors shadow-sm">
                     {{ memberActionBusy() ? 'Creating...' : 'Create Identity' }}
                  </button>

                  <button *ngIf="editGhostMemberId()" type="button" (click)="updateGhostMember()" [disabled]="!canEditGhostMember() || memberActionBusy()" class="px-6 py-2 bg-primary text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-primary-light transition-colors shadow-sm">
                     {{ memberActionBusy() ? 'Saving...' : 'Save Changes' }}
                  </button>
               </div>
            </section>
         </div>
      </div>
    </div>
  `
})
export class GhostSetupComponent implements OnInit, OnDestroy {
   private communityService = inject(CommunityService);

   loadingMembers = signal<boolean>(false);
   settingsBusy = signal<boolean>(false);
   memberActionBusy = signal<boolean>(false);

   communityTitleDraft = '';
   activeMembersDraft = 89;
   settingsInitialized = false;

   memberSearch = '';
   memberSearchTimer: number | null = null;

   newDisplayName = signal<string>('');
   newGhostId = signal<string>('');
   newIdentityTag = signal<string>('');
   newInfo = signal<string>('');

   editGhostMemberId = signal<number>(0);
   editDisplayName = signal<string>('');
   editGhostId = signal<string>('');
   editIdentityTag = signal<string>('');
   editInfo = signal<string>('');

   ghostMembers = this.communityService.personas;
   safetyRules = this.communityService.safetyRules;
   actionError = this.communityService.actionError;

   canCreateGhostMember = computed(() =>
      this.newDisplayName().trim().length > 0 &&
      this.newGhostId().trim().length > 0 &&
      this.newIdentityTag().trim().length > 0
   );

   canEditGhostMember = computed(() =>
      this.editGhostMemberId() > 0 &&
      this.editDisplayName().trim().length > 0 &&
      this.editIdentityTag().trim().length > 0
   );

   ngOnInit(): void {
      this.communityService.loadSettings().subscribe(settings => {
         this.communityTitleDraft = String(settings.community_title || '').trim() || 'community chat.';
         this.activeMembersDraft = Number(settings.active_members_display || 89);
         this.settingsInitialized = true;
      });
      this.loadGhostMembers();
   }

   ngOnDestroy(): void {
      if (this.memberSearchTimer !== null) {
         window.clearTimeout(this.memberSearchTimer);
         this.memberSearchTimer = null;
      }
   }

   loadGhostMembers(): void {
      this.loadingMembers.set(true);
      this.communityService.loadGhostMembers(this.memberSearch).subscribe(() => {
         this.loadingMembers.set(false);
      });
   }

   onGhostSearchChange(_value: string): void {
      if (this.memberSearchTimer !== null) {
         window.clearTimeout(this.memberSearchTimer);
      }
      this.memberSearchTimer = window.setTimeout(() => this.loadGhostMembers(), 300);
   }

   saveCommunitySettings(): void {
      const title = String(this.communityTitleDraft || '').trim() || 'community chat.';
      const members = Number(this.activeMembersDraft);
      if (!Number.isFinite(members) || members <= 0) {
         return;
      }

      this.settingsBusy.set(true);
      this.communityService.updateSettings({
         community_title: title,
         active_members_display: members
      }).subscribe((settings) => {
         this.settingsBusy.set(false);
         if (!settings) return;
         this.communityTitleDraft = settings.community_title;
         this.activeMembersDraft = settings.active_members_display;
      });
   }

   createGhostMember(): void {
      if (!this.canCreateGhostMember() || this.memberActionBusy()) {
         return;
      }

      const normalizedGhostId = this.normalizeGhostId(this.newGhostId());
      this.newGhostId.set(normalizedGhostId);

      this.memberActionBusy.set(true);
      this.communityService.createGhostMember({
         display_name: this.newDisplayName().trim(),
         ghost_id: normalizedGhostId,
         identity_tag: this.newIdentityTag().trim(),
         info: this.newInfo().trim()
      }).subscribe((created) => {
         this.memberActionBusy.set(false);
         if (!created) return;
         this.newDisplayName.set('');
         this.newGhostId.set('');
         this.newIdentityTag.set('');
         this.newInfo.set('');
         this.loadGhostMembers();
      });
   }

   pickMemberForEdit(member: CommunityPersona): void {
      this.editGhostMemberId.set(member.id);
      this.editDisplayName.set(member.display_name);
      this.editGhostId.set(member.ghost_id);
      this.editIdentityTag.set(member.identity_tag);
      this.editInfo.set(member.info);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
   }

   clearEditGhostMember(): void {
      this.editGhostMemberId.set(0);
      this.editDisplayName.set('');
      this.editGhostId.set('');
      this.editIdentityTag.set('');
      this.editInfo.set('');
   }

   updateGhostMember(): void {
      const memberId = this.editGhostMemberId();
      if (!memberId || !this.canEditGhostMember() || this.memberActionBusy()) {
         return;
      }

      this.memberActionBusy.set(true);
      this.communityService.updateGhostMember(memberId, {
         display_name: this.editDisplayName().trim(),
         identity_tag: this.editIdentityTag().trim(),
         info: this.editInfo().trim()
      }).subscribe((updated) => {
         this.memberActionBusy.set(false);
         if (!updated) return;
         this.clearEditGhostMember();
         this.loadGhostMembers();
      });
   }

   deleteGhostMember(): void {
      const memberId = this.editGhostMemberId();
      if (!memberId || this.memberActionBusy()) {
         return;
      }

      const ok = window.confirm('Delete this ghost member? This will remove them from the Ghost Identity dropdown.');
      if (!ok) return;

      this.memberActionBusy.set(true);
      this.communityService.deleteGhostMember(memberId).subscribe((deleted) => {
         this.memberActionBusy.set(false);
         if (!deleted) return;
         this.clearEditGhostMember();
         this.loadGhostMembers();
      });
   }

   trackByGhostMember(_index: number, member: CommunityPersona): number {
      return member.id;
   }

   avatarLabel(name: string): string {
      const clean = String(name || '').trim();
      return clean ? clean[0].toUpperCase() : 'U';
   }

   normalizeNewGhostId(): void {
      this.newGhostId.set(this.normalizeGhostId(this.newGhostId()));
   }

   private normalizeGhostId(value: string): string {
      return String(value || '')
         .trim()
         .toLowerCase()
         .replace(/\s+/g, '_')
         .replace(/[^a-z0-9_-]/g, '_')
         .replace(/_+/g, '_')
         .replace(/^_+|_+$/g, '')
         .slice(0, 40);
   }
}
