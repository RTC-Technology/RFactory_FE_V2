import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { TabReuseStrategy } from './core/strategies/tab-reuse.strategy';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { SecureStorageService } from './core/services/secure-storage.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Order matters: authInterceptor attaches the token and refreshes proactively;
    // errorInterceptor sits behind it and catches a 401 that still slipped through —
    // a token the server revoked early, or one that expired mid-flight. It was imported
    // but never registered, which left no fallback at all.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    // Decrypt everything persisted before the router's guards run — they, the auth
    // interceptor and the language service all read synchronously.
    provideAppInitializer(() => inject(SecureStorageService).init()),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '[data-theme="dark"]' },
      },
    }),

    // Đăng ký custom RouteReuseStrategy để giữ state tab khi chuyển tab
    {
      provide: RouteReuseStrategy,
      useClass: TabReuseStrategy,
    },
  ],
};
