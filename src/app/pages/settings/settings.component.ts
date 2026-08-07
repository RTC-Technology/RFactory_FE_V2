import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabService } from '../../core/services/tab.service';
import { I18nService } from '../../core/services/i18n.service';
import { Lang } from '../../core/i18n/translations';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page__header">
        <h1 class="page__title">{{ i18n.t('settings.title') }}</h1>
        <p class="page__sub">{{ i18n.t('settings.subtitle') }}</p>
      </div>

      <div class="settings-layout">
        <div class="glass-card settings-panel">
          <h3>{{ i18n.t('settings.general') }}</h3>
          <div class="form-group">
            <label>{{ i18n.t('settings.appName') }}</label>
            <input class="form-input" value="RFactory MES"/>
          </div>
          <div class="form-group">
            <label>{{ i18n.t('settings.theme') }}</label>
            <select class="form-input">
              <option>{{ i18n.t('settings.themeLight') }}</option>
              <option>{{ i18n.t('settings.themeDark') }}</option>
            </select>
          </div>
          <div class="form-group">
            <!-- Unlike the two above, this one is live: it drives I18nService directly
                 rather than waiting on a Save that is not wired up yet. -->
            <label for="settings-lang">{{ i18n.t('settings.language') }}</label>
            <select id="settings-lang" class="form-input"
                    [value]="i18n.lang()" (change)="onLangChange($event)">
              <option value="vi">{{ i18n.t('settings.langVi') }}</option>
              <option value="en">{{ i18n.t('settings.langEn') }}</option>
            </select>
          </div>
          <button class="btn btn--primary">{{ i18n.t('settings.save') }}</button>
        </div>

        <!-- Menu declaration moved to its own page; this keeps the old entry point discoverable. -->
        <div class="glass-card settings-panel pointer">
          <div>
            <h3>{{ i18n.t('settings.menuCard.title') }}</h3>
            <p class="pointer__sub">{{ i18n.t('settings.menuCard.desc') }}</p>
          </div>
          <button class="btn btn--ghost btn--sm" (click)="openMenuManager()">
            {{ i18n.t('settings.menuCard.open') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page{animation:fadeUp 0.3s ease;}
    .page__header{margin-bottom:24px;}
    .page__title{font-size:22px;font-weight:700;color:var(--text-primary);margin:0 0 4px;}
    .page__sub{color:var(--text-muted);margin:0;font-size:13px;}
    .glass-card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:24px;}
    .settings-layout{display:flex;flex-direction:column;gap:16px;}
    .settings-panel h3{margin:0 0 20px;font-size:15px;font-weight:700;color:var(--text-primary);}
    .form-group{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
    label{font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;}
    .form-input{padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:var(--text-primary);font-size:13px;outline:none;&:focus{border-color:var(--accent);}}
    .btn{padding:9px 20px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s;&:hover{opacity:0.85;}}
    .btn--primary{background:var(--accent);color:#fff;}
    .btn--ghost{background:transparent;border:1px solid var(--border);color:var(--text-secondary);}
    .btn--sm{padding:6px 14px;font-size:12px;}
    .pointer{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
    .pointer h3{margin:0 0 4px;}
    .pointer__sub{margin:0;font-size:12.5px;color:var(--text-muted);}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
  `]
})
export class SettingsComponent {
  private readonly tabService = inject(TabService);
  readonly i18n = inject(I18nService);

  onLangChange(event: Event): void {
    this.i18n.setLang((event.target as HTMLSelectElement).value as Lang);
  }

  openMenuManager(): void {
    this.tabService.openTab({
      id: 'menu-manager',
      title: this.i18n.t('menu.title'),
      route: '/menu-manager',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    });
  }
}
