import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
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

      @if (missing().length) {
        <div class="forbidden__codes">
          <p class="forbidden__codes-label">
            {{ i18n.t(mode() === 'all' ? 'forbidden.needAll' : 'forbidden.needAny') }}
          </p>
          <ul class="forbidden__list">
            @for (code of missing(); track code) {
              <li><code>{{ code }}</code></li>
            }
          </ul>
          <p class="forbidden__hint">{{ i18n.t('forbidden.hint') }}</p>
        </div>
      }

      <a class="btn" routerLink="/dashboard">{{ i18n.t('forbidden.back') }}</a>
    </div>
  `,
  styles: [`
    .forbidden {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 64px 20px; color: var(--text-secondary);
      animation: fadeUp .3s ease;
    }
    .forbidden__icon { width: 56px; height: 56px; color: #ef4444; margin-bottom: 16px; }
    .forbidden__icon svg { width: 100%; height: 100%; }
    h1 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; }
    p { font-size: 13px; color: var(--text-muted); margin: 0 0 20px; }
    .forbidden__codes {
      margin: 0 0 20px; padding: 14px 20px; max-width: 420px;
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px;
    }
    .forbidden__codes-label { margin: 0 0 8px; font-size: 12.5px; color: var(--text-secondary); }
    .forbidden__list { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .forbidden__list code {
      font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
      font-size: 12px; padding: 3px 9px; border-radius: 5px;
      background: var(--input-bg); border: 1px solid var(--border); color: var(--text-primary);
    }
    .forbidden__hint { margin: 0; font-size: 11.5px; line-height: 1.5; }
    .btn { padding: 9px 20px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class ForbiddenComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);

  /** Filled by permissionGuard. Absent when the page is reached directly. */
  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly missing = computed(() =>
    (this.params().get('required') ?? '').split(',').map(c => c.trim()).filter(Boolean));

  readonly mode = computed(() => this.params().get('mode') ?? 'any');
}
