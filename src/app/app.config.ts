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
    provideHttpClient(withInterceptors([authInterceptor])),
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
