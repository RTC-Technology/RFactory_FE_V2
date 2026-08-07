import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-shell">
      <div class="login-card">
        <div class="login-brand">
          <img class="login-brand__logo" src="logo/login-logo.png" alt="RFactory MES" />
        </div>

        <h1 class="login-title">{{ i18n.t('login.title') }}</h1>
        <p class="login-sub">{{ i18n.t('login.subtitle') }}</p>

        @if (error()) {
          <div class="login-error">{{ error() }}</div>
        }

        <form (ngSubmit)="submit()">
          <div class="form-group">
            <label>{{ i18n.t('login.username') }}</label>
            <input class="form-input" name="username" [(ngModel)]="username" [disabled]="loading()" autocomplete="username" />
          </div>
          <div class="form-group">
            <label>{{ i18n.t('login.password') }}</label>
            <input class="form-input" type="password" name="password" [(ngModel)]="password" [disabled]="loading()" autocomplete="current-password" />
          </div>
          <button class="btn btn--primary btn--block" type="submit" [disabled]="loading()">
            {{ loading() ? i18n.t('login.submitting') : i18n.t('login.submit') }}
          </button>
        </form>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; width: 100vw; }
    .login-shell {
      height: 100%; width: 100%;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-base);
      background-image: radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 40%),
                         radial-gradient(circle at 80% 80%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 40%);
    }
    .login-card {
      width: 360px;
      padding: 32px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(20px);
      animation: fadeUp .3s ease;
    }
    .login-brand { display: flex; justify-content: center; margin-bottom: 24px; }
    /* Width-bound: the source is 1200px wide, so height follows the aspect ratio and the
       browser downscales once rather than the layout guessing. */
    .login-brand__logo { width: 190px; height: auto; max-width: 100%; }
    .login-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .login-sub { font-size: 13px; color: var(--text-muted); margin: 0 0 20px; }
    .login-error {
      font-size: 12.5px; color: #ef4444; background: color-mix(in srgb, #ef4444 10%, transparent);
      border: 1px solid color-mix(in srgb, #ef4444 25%, transparent); border-radius: 8px;
      padding: 8px 12px; margin-bottom: 16px;
    }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .form-input {
      padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--input-bg); color: var(--text-primary); font-size: 13px; outline: none;
      &:focus { border-color: var(--accent); }
      &:disabled { opacity: .6; }
    }
    .btn { padding: 10px 20px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .15s; &:hover:not(:disabled) { opacity: .85; } &:disabled { opacity: .6; cursor: not-allowed; } }
    .btn--primary { background: var(--accent); color: #fff; }
    .btn--block { width: 100%; margin-top: 4px; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.error.set(this.i18n.t('login.errorEmpty'));
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.authService.login({ username: this.username.trim(), password: this.password })
      .pipe(
        // Released on every exit, success included. The success path navigates away and
        // the component is normally destroyed, but a guard can bounce the return URL
        // straight back here — and then a flag only cleared on error leaves the form
        // stuck reading "signing in…" with the button disabled.
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err: HttpErrorResponse) =>
          this.error.set(err.error?.message || this.i18n.t('login.errorFailed')),
      });
  }
}
