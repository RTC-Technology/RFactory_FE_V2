import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="forbidden">
      <div class="forbidden__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/>
        </svg>
      </div>
      <h1>{{ i18n.t('forbidden.title') }}</h1>
      <p>{{ i18n.t('forbidden.message') }}</p>
      <a class="btn" routerLink="/dashboard">{{ i18n.t('forbidden.back') }}</a>
    </div>
  `,
  styles: [`
    .forbidden {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 80px 20px; color: var(--text-secondary);
      animation: fadeUp .3s ease;
    }
    .forbidden__icon { width: 56px; height: 56px; color: #ef4444; margin-bottom: 16px; }
    .forbidden__icon svg { width: 100%; height: 100%; }
    h1 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; }
    p { font-size: 13px; color: var(--text-muted); margin: 0 0 20px; }
    .btn { padding: 9px 20px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class ForbiddenComponent {
  readonly i18n = inject(I18nService);
}
