import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import {
    AgentUserDetail,
    AgentUserDetailResponse,
    AgentUserSummary,
    AgentUsersResponse
} from '../models/agent-user.model';

@Injectable({
    providedIn: 'root'
})
export class AgentUserApiService {
    private readonly usersState = signal<AgentUserSummary[]>([]);
    private readonly loadingState = signal<boolean>(false);

    readonly users = this.usersState.asReadonly();
    readonly loading = this.loadingState.asReadonly();
    readonly usersById = computed(() => {
        const mapById = new Map<string, AgentUserSummary>();
        for (const user of this.usersState()) {
            mapById.set(String(user.id), user);
        }
        return mapById;
    });

    constructor(private http: HttpClient) { }

    loadUsers(forceRefresh: boolean = false): Observable<AgentUserSummary[]> {
        if (!forceRefresh && this.usersState().length > 0) {
            return of(this.usersState());
        }

        this.loadingState.set(true);
        return this.http.get<AgentUsersResponse>('/api/agent/users').pipe(
            map((response) => response?.users || []),
            tap((users) => {
                const normalized = users.map(user => ({
                    ...user,
                    id: String(user.id)
                }));
                this.usersState.set(normalized);
            }),
            catchError((error: unknown) => {
                if (error instanceof HttpErrorResponse && error.status === 403) {
                    this.usersState.set([]);
                }
                return of(this.usersState());
            }),
            finalize(() => this.loadingState.set(false))
        );
    }

    getUserDetail(userId: string): Observable<AgentUserDetail | null> {
        return this.http.get<AgentUserDetailResponse>(`/api/agent/users/${userId}`).pipe(
            map((response) => {
                if (!response?.user) {
                    return null;
                }
                const detail = {
                    ...response.user,
                    id: String(response.user.id)
                };
                this.upsertSummary(detail);
                return detail;
            }),
            catchError(() => of(null))
        );
    }

    setUserEnabled(userId: string, enabled: boolean): Observable<AgentUserDetail | null> {
        const action = enabled ? 'enable' : 'disable';
        return this.http.patch<AgentUserDetailResponse>(`/api/agent/users/${userId}`, { action }).pipe(
            map((response) => {
                if (!response?.user) return null;
                const detail = {
                    ...response.user,
                    id: String(response.user.id)
                };
                this.upsertSummary(detail);
                return detail;
            }),
            catchError(() => of(null))
        );
    }

    deleteUser(userId: string): Observable<boolean> {
        return this.http.delete(`/api/agent/users/${userId}`).pipe(
            map(() => true),
            tap(() => {
                this.usersState.update((users) => users.filter(user => String(user.id) !== String(userId)));
            }),
            catchError(() => of(false))
        );
    }

    private upsertSummary(detail: AgentUserDetail): void {
        const summary: AgentUserSummary = {
            id: String(detail.id),
            full_name: detail.full_name,
            email: detail.email,
            mobile_number: detail.mobile_number,
            requested_amount: detail.requested_amount,
            marital_status: detail.marital_status,
            is_active: detail.is_active,
            is_chat_favorite: detail.is_chat_favorite,
            agreement_tab_enabled: detail.agreement_tab_enabled,
            agreement_completed_at: detail.agreement_completed_at,
            last_location: detail.last_location,
            last_login: detail.last_login,
            profile_complete: detail.profile_complete,
            profile_progress: detail.profile_progress,
            missing_fields: detail.missing_fields,
            filled_fields_count: detail.filled_fields_count,
            total_required_fields: detail.total_required_fields
        };

        this.usersState.update((users) => {
            const idx = users.findIndex(item => String(item.id) === String(summary.id));
            if (idx === -1) {
                return [summary, ...users];
            }
            const next = [...users];
            next[idx] = summary;
            return next;
        });
    }
}
