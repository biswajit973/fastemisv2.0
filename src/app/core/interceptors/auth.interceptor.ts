import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const isAuthEntryRequest =
        /\/api\/(login|signup|register)\/?$/.test(req.url)
        || /\/api\/agent\/(login|access)\/?$/.test(req.url);

    // Do not attach stale/invalid JWT on authentication entry calls.
    if (isAuthEntryRequest) {
        return next(req);
    }

    const storage = inject(StorageService);
    // Prefer in-memory session token for the active runtime to avoid role-token
    // mismatch when multiple tabs switch between user/agent logins.
    const token = storage.getSessionToken() || storage.getCookie('jwt_token');

    if (token) {
        const cloned = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
        return next(cloned);
    }

    return next(req);
};
