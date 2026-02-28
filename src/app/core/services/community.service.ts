import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

export interface CommunityPersona {
  id: number;
  ghost_member_id: number;
  ghost_id: string;
  display_name: string;
  identity_tag: string;
  info: string;
  avatar_url: string;
  short_bio: string;
  tone_guidelines: string;
  is_active: boolean;
  sort_order: number;
}

export interface CommunityPost {
  id: number;
  parent_id: number | null;
  author_type: 'user' | 'persona';
  user_id: string | null;
  persona_id: number | null;
  ghost_member_id: number | null;
  ghost_member_identity_tag: string;
  ghost_member_info: string;
  can_reply_privately: boolean;
  author_name: string;
  author_avatar: string;
  author_bio: string;
  content: string;
  mediaUrl: string;
  mediaName: string;
  content_masked: boolean;
  moderation_note: string;
  created_at: string;
}

export interface CommunitySettings {
  community_title: string;
  active_members_display: number;
  updated_at?: string;
}

export interface CommunityFeedEntry {
  post: CommunityPost;
  replies: CommunityPost[];
  reply_count: number;
}

interface CommunityFeedResponse {
  feed?: Array<{
    post?: Record<string, unknown>;
    replies?: Array<Record<string, unknown>>;
    reply_count?: number;
  }>;
  settings?: Record<string, unknown>;
  personas?: Array<Record<string, unknown>>;
  ghost_members?: Array<Record<string, unknown>>;
  safety_rules?: string[];
}

interface CommunityPostMutationResponse {
  post?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  readonly feed = signal<CommunityFeedEntry[]>([]);
  readonly personas = signal<CommunityPersona[]>([]);
  readonly actionError = signal<string>('');
  readonly settings = signal<CommunitySettings>({
    community_title: 'community chat.',
    active_members_display: 89
  });
  readonly safetyRules = signal<string[]>([]);

  constructor(private http: HttpClient) {}

  loadFeed(limit: number = 25, replyLimit: number = 6): Observable<CommunityFeedEntry[]> {
    const params = new HttpParams()
      .set('limit', String(limit))
      .set('reply_limit', String(replyLimit));

    return this.http.get<CommunityFeedResponse>('/api/community/feed', { params }).pipe(
      map((response) => {
        const rawGhostMembers = response?.ghost_members || response?.personas || [];
        const ghostMembers = Array.isArray(rawGhostMembers)
          ? rawGhostMembers.map((raw) => this.mapPersona(raw)).filter((item): item is CommunityPersona => !!item)
          : [];

        const entries = Array.isArray(response?.feed)
          ? response!.feed!.map((entry) => this.mapFeedEntry(entry)).filter((item): item is CommunityFeedEntry => !!item)
          : [];

        const safetyRules = Array.isArray(response?.safety_rules) ? (response?.safety_rules as string[]) : [];
        const settings = this.mapSettings(response?.settings || null);

        this.personas.set(ghostMembers);
        this.safetyRules.set(safetyRules);
        if (settings) {
          this.settings.set(settings);
        }

        return this.sortFeedEntries(entries);
      }),
      tap((entries) => this.feed.set(entries)),
      catchError(() => of(this.feed()))
    );
  }

  loadGhostMembers(search: string = ''): Observable<CommunityPersona[]> {
    let params = new HttpParams();
    const q = String(search || '').trim();
    if (q) {
      params = params.set('q', q);
    }

    return this.http.get<{ ghost_members?: Array<Record<string, unknown>>; personas?: Array<Record<string, unknown>> }>('/api/community/ghost-members', { params }).pipe(
      map((response) => {
        const raw = response?.ghost_members || response?.personas || [];
        return raw.map((item) => this.mapPersona(item)).filter((item): item is CommunityPersona => !!item);
      }),
      tap((members) => this.personas.set(members)),
      catchError(() => of(this.personas()))
    );
  }

  loadPersonas(search: string = ''): Observable<CommunityPersona[]> {
    return this.loadGhostMembers(search);
  }

  createGhostMember(payload: {
    display_name: string;
    ghost_id: string;
    identity_tag: string;
    info: string;
    is_active?: boolean;
    sort_order?: number;
    avatar_url?: string;
    short_bio?: string;
    tone_guidelines?: string;
  }): Observable<CommunityPersona | null> {
    this.actionError.set('');

    const normalizedPayload = {
      ...payload,
      display_name: String(payload.display_name || '').trim(),
      ghost_id: this.normalizeGhostId(payload.ghost_id),
      identity_tag: String(payload.identity_tag || '').trim(),
      info: String(payload.info || '').trim()
    };

    if (!normalizedPayload.display_name) {
      this.actionError.set('display_name: Display name is required.');
      return of(null);
    }
    if (normalizedPayload.ghost_id.length < 3) {
      this.actionError.set('ghost_id: Ghost ID must match [A-Za-z0-9_-]{3,40}.');
      return of(null);
    }
    if (!normalizedPayload.identity_tag) {
      this.actionError.set('identity_tag: Identity tag is required.');
      return of(null);
    }

    return this.http.post<{ ghost_member?: Record<string, unknown>; persona?: Record<string, unknown> }>('/api/community/ghost-members', normalizedPayload).pipe(
      map((response) => this.mapPersona(response?.ghost_member || response?.persona || null)),
      tap((created) => {
        if (!created) return;
        this.personas.update((current) => {
          const next = [created, ...current.filter((item) => item.id !== created.id)];
          return this.sortMembers(next);
        });
        this.actionError.set('');
      }),
      catchError((error) => {
        this.actionError.set(this.extractApiError(error, 'Unable to create ghost member.'));
        return of(null);
      })
    );
  }

  createPersona(payload: {
    display_name: string;
    ghost_id?: string;
    identity_tag?: string;
    info?: string;
    is_active?: boolean;
    sort_order?: number;
    avatar_url?: string;
    short_bio?: string;
    tone_guidelines?: string;
  }): Observable<CommunityPersona | null> {
    return this.createGhostMember({
      display_name: String(payload.display_name || '').trim(),
      ghost_id: String(payload.ghost_id || '').trim(),
      identity_tag: String(payload.identity_tag || '').trim(),
      info: String(payload.info || '').trim(),
      is_active: payload.is_active,
      sort_order: payload.sort_order,
      avatar_url: payload.avatar_url,
      short_bio: payload.short_bio,
      tone_guidelines: payload.tone_guidelines
    });
  }

  updateGhostMember(memberId: number, patch: Partial<CommunityPersona>): Observable<CommunityPersona | null> {
    this.actionError.set('');
    return this.http.patch<{ ghost_member?: Record<string, unknown>; persona?: Record<string, unknown> }>(`/api/community/ghost-members/${memberId}`, patch).pipe(
      map((response) => this.mapPersona(response?.ghost_member || response?.persona || null)),
      tap((updated) => {
        if (!updated) return;
        this.personas.update((current) => this.sortMembers(current.map((item) => item.id === updated.id ? updated : item)));
        this.actionError.set('');
      }),
      catchError((error) => {
        this.actionError.set(this.extractApiError(error, 'Unable to update ghost member.'));
        return of(null);
      })
    );
  }

  updatePersona(memberId: number, patch: Partial<CommunityPersona>): Observable<CommunityPersona | null> {
    return this.updateGhostMember(memberId, patch);
  }

  deleteGhostMember(memberId: number): Observable<boolean> {
    this.actionError.set('');
    return this.http.delete(`/api/community/ghost-members/${memberId}`).pipe(
      map(() => true),
      tap(() => {
        this.personas.update((current) => current.filter((item) => item.id !== memberId));
        this.feed.update((entries) => entries
          .map((entry) => ({
            ...entry,
            replies: entry.replies.filter((reply) => reply.ghost_member_id !== memberId)
          }))
          .filter((entry) => entry.post.ghost_member_id !== memberId)
        );
        this.actionError.set('');
      }),
      catchError((error) => {
        this.actionError.set(this.extractApiError(error, 'Unable to delete ghost member.'));
        return of(false);
      })
    );
  }

  loadSettings(): Observable<CommunitySettings> {
    return this.http.get<{ settings?: Record<string, unknown> }>('/api/community/settings').pipe(
      map((response) => this.mapSettings(response?.settings || null) || this.settings()),
      tap((settings) => this.settings.set(settings)),
      catchError(() => of(this.settings()))
    );
  }

  updateSettings(patch: Partial<CommunitySettings>): Observable<CommunitySettings | null> {
    return this.http.patch<{ settings?: Record<string, unknown> }>('/api/community/settings', patch).pipe(
      map((response) => this.mapSettings(response?.settings || null)),
      tap((settings) => {
        if (settings) {
          this.settings.set(settings);
        }
      }),
      catchError(() => of(null))
    );
  }

  postQuestion(content: string, mediaFile?: File | null): Observable<boolean> {
    const text = String(content || '').trim();
    if (!text && !mediaFile) {
      return of(false);
    }

    const payload: FormData | { content: string } = mediaFile
      ? this.toMultipartPayload({ content: text, mediaFile })
      : { content: text };

    return this.http.post<CommunityPostMutationResponse>('/api/community/feed', payload).pipe(
      map((response) => this.mapPost(response?.post || null)),
      tap((post) => {
        if (!post) {
          this.loadFeed().subscribe();
          return;
        }
        this.integrateIncomingPost(post);
      }),
      map((post) => !!post),
      catchError(() => of(false))
    );
  }

  postAsGhostMember(input: {
    content: string;
    ghost_member_id: number;
    parent_id?: number;
    mediaFile?: File | null;
  }): Observable<boolean> {
    const text = String(input.content || '').trim();
    const memberId = Number(input.ghost_member_id || 0);
    const parentId = input.parent_id ? Number(input.parent_id) : undefined;
    if ((!text && !input.mediaFile) || !Number.isFinite(memberId) || memberId <= 0) {
      return of(false);
    }

    const payload: FormData | Record<string, unknown> = input.mediaFile
      ? this.toMultipartPayload({
          content: text,
          ghostMemberId: memberId,
          parentId,
          mediaFile: input.mediaFile
        })
      : {
          content: text,
          ghost_member_id: memberId,
          ...(parentId ? { parent_id: parentId } : {})
        };

    return this.http.post<CommunityPostMutationResponse>('/api/community/feed', payload).pipe(
      map((response) => this.mapPost(response?.post || null)),
      tap((post) => {
        if (!post) {
          this.loadFeed().subscribe();
          return;
        }
        this.integrateIncomingPost(post);
      }),
      map((post) => !!post),
      catchError(() => of(false))
    );
  }

  replyAsPersona(parentId: number, content: string, personaId: number, mediaFile?: File | null): Observable<boolean> {
    return this.postAsGhostMember({
      content,
      ghost_member_id: personaId,
      parent_id: parentId,
      mediaFile
    });
  }

  static hasRestrictedContact(text: string): boolean {
    const source = String(text || '');
    const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(source);
    const hasPhone = /(?<!\d)(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){10,12}(?!\d)/.test(source);
    return hasEmail || hasPhone;
  }

  private sortMembers(items: CommunityPersona[]): CommunityPersona[] {
    return [...items].sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name));
  }

  private integrateIncomingPost(post: CommunityPost): void {
    this.feed.update((entries) => {
      if (!post.parent_id) {
        const exists = entries.find((entry) => entry.post.id === post.id);
        if (exists) {
          return this.sortFeedEntries(entries.map((entry) => entry.post.id === post.id
            ? { ...entry, post }
            : entry
          ));
        }
        return this.sortFeedEntries([...entries, { post, replies: [], reply_count: 0 }]);
      }

      let parentFound = false;
      const next = entries.map((entry) => {
        if (entry.post.id !== post.parent_id) {
          return entry;
        }
        parentFound = true;
        const existingReplies = entry.replies.filter((reply) => reply.id !== post.id);
        return {
          ...entry,
          replies: [...existingReplies, post].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
          reply_count: Math.max(entry.reply_count + (existingReplies.length === entry.replies.length ? 1 : 0), existingReplies.length + 1)
        };
      });

      if (!parentFound) {
        this.loadFeed().subscribe();
      }
      return this.sortFeedEntries(next);
    });
  }

  private sortFeedEntries(entries: CommunityFeedEntry[]): CommunityFeedEntry[] {
    return [...entries].sort((a, b) => {
      const aTs = new Date(a.post.created_at).getTime();
      const bTs = new Date(b.post.created_at).getTime();
      const aSafe = Number.isFinite(aTs) ? aTs : 0;
      const bSafe = Number.isFinite(bTs) ? bTs : 0;
      if (aSafe !== bSafe) {
        return aSafe - bSafe;
      }
      return a.post.id - b.post.id;
    });
  }

  private mapPersona(raw: Record<string, unknown> | null): CommunityPersona | null {
    if (!raw) return null;
    const id = Number(raw['id'] ?? raw['ghost_member_id']);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }

    return {
      id,
      ghost_member_id: id,
      ghost_id: String(raw['ghost_id'] || ''),
      display_name: String(raw['display_name'] || 'Community Member'),
      identity_tag: String(raw['identity_tag'] || ''),
      info: String(raw['info'] || ''),
      avatar_url: String(raw['avatar_url'] || ''),
      short_bio: String(raw['short_bio'] || ''),
      tone_guidelines: String(raw['tone_guidelines'] || ''),
      is_active: Boolean(raw['is_active'] ?? true),
      sort_order: Number(raw['sort_order'] || 100)
    };
  }

  private mapSettings(raw: Record<string, unknown> | null): CommunitySettings | null {
    if (!raw) return null;
    const activeMembers = Number(raw['active_members_display']);
    return {
      community_title: String(raw['community_title'] || 'community chat.'),
      active_members_display: Number.isFinite(activeMembers) && activeMembers > 0 ? activeMembers : 89,
      updated_at: raw['updated_at'] ? String(raw['updated_at']) : undefined
    };
  }

  private mapPost(raw: Record<string, unknown> | null): CommunityPost | null {
    if (!raw) return null;
    const id = Number(raw['id']);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }

    const authorTypeRaw = String(raw['author_type'] || 'user');
    const authorType = authorTypeRaw === 'persona' ? 'persona' : 'user';
    const ghostMemberId = raw['ghost_member_id'] != null ? Number(raw['ghost_member_id']) : (raw['persona_id'] != null ? Number(raw['persona_id']) : null);

    return {
      id,
      parent_id: raw['parent_id'] != null ? Number(raw['parent_id']) : null,
      author_type: authorType,
      user_id: raw['user_id'] ? String(raw['user_id']) : null,
      persona_id: raw['persona_id'] != null ? Number(raw['persona_id']) : null,
      ghost_member_id: ghostMemberId && Number.isFinite(ghostMemberId) ? ghostMemberId : null,
      ghost_member_identity_tag: String(raw['ghost_member_identity_tag'] || ''),
      ghost_member_info: String(raw['ghost_member_info'] || ''),
      can_reply_privately: Boolean(raw['can_reply_privately']),
      author_name: String(raw['author_name'] || (authorType === 'persona' ? 'Community Member' : 'User')),
      author_avatar: String(raw['author_avatar'] || ''),
      author_bio: String(raw['author_bio'] || ''),
      content: String(raw['content'] || ''),
      mediaUrl: String(raw['mediaUrl'] || raw['media_url'] || ''),
      mediaName: String(raw['mediaName'] || raw['media_name'] || ''),
      content_masked: Boolean(raw['content_masked']),
      moderation_note: String(raw['moderation_note'] || ''),
      created_at: String(raw['created_at'] || new Date().toISOString())
    };
  }

  private mapFeedEntry(raw: {
    post?: Record<string, unknown>;
    replies?: Array<Record<string, unknown>>;
    reply_count?: number;
  }): CommunityFeedEntry | null {
    const post = this.mapPost(raw?.post || null);
    if (!post) {
      return null;
    }

    const replies = Array.isArray(raw?.replies)
      ? raw.replies.map((item) => this.mapPost(item)).filter((item): item is CommunityPost => !!item)
      : [];

    return {
      post,
      replies,
      reply_count: Number(raw?.reply_count || replies.length)
    };
  }

  private toMultipartPayload(input: {
    content: string;
    parentId?: number;
    ghostMemberId?: number;
    mediaFile?: File | null;
  }): FormData {
    const formData = new FormData();
    if (input.content) {
      formData.append('content', input.content);
    }
    if (input.parentId) {
      formData.append('parent_id', String(input.parentId));
    }
    if (input.ghostMemberId) {
      formData.append('ghost_member_id', String(input.ghostMemberId));
    }
    if (input.mediaFile) {
      formData.append('media_file', input.mediaFile);
    }
    return formData;
  }

  private extractApiError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    const payload = error.error;
    if (payload && typeof payload === 'object') {
      const entries = Object.entries(payload as Record<string, unknown>);
      if (entries.length > 0) {
        const [key, value] = entries[0];
        const label = key === 'error' ? '' : `${key}: `;
        if (Array.isArray(value) && value.length > 0) {
          return `${label}${String(value[0])}`.trim();
        }
        if (value != null && String(value).trim()) {
          return `${label}${String(value)}`.trim();
        }
      }
    }

    if (typeof payload === 'string' && payload.trim()) {
      return payload.trim();
    }
    return fallback;
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
