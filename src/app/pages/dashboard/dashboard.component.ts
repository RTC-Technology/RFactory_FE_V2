import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/components/icon.component';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="page page--dashboard">
      <div class="page__header">
        <h1 class="page__title">{{ i18n.t('dashboard.title') }}</h1>
        <p class="page__sub">{{ i18n.t('dashboard.subtitle') }}</p>
      </div>

      <div class="stats-grid">
        @for (stat of stats; track stat.labelKey) {
          <div class="stat-card" [style.--accent]="stat.color">
            <div class="stat-card__icon"><app-icon [value]="stat.icon" /></div>
            <div class="stat-card__body">
              <div class="stat-card__value">{{ stat.value }}</div>
              <div class="stat-card__label">{{ i18n.t(stat.labelKey) }}</div>
            </div>
            <div class="stat-card__trend" [class.trend--up]="stat.up">
              {{ stat.up ? '▲' : '▼' }} {{ stat.change }}
            </div>
          </div>
        }
      </div>

      <div class="dashboard-grid">
        <div class="glass-card activity-card">
          <h3>{{ i18n.t('dashboard.recentActivity') }}</h3>
          <ul class="activity-list">
            @for (a of activities; track a.key) {
              <li class="activity-item">
                <span class="activity-dot" [style.background]="a.color"></span>
                <div>
                  <div class="activity-text">{{ i18n.t(a.key) }}</div>
                  <div class="activity-time">{{ i18n.t(a.timeKey, { n: a.n }) }}</div>
                </div>
              </li>
            }
          </ul>
        </div>

        <div class="glass-card chart-card">
          <h3>{{ i18n.t('dashboard.performance') }}</h3>
          <div class="bar-chart">
            @for (b of bars; track b.month) {
              <div class="bar-wrap">
                <div class="bar" [style.height]="b.h + '%'" [style.background]="b.color"></div>
                <span class="bar-label">{{ i18n.t('month.' + b.month) }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { animation: fadeUp 0.3s ease; }
    .page__header { margin-bottom: 24px; }
    .page__title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page__sub { color: var(--text-muted); margin: 0; font-size: 13px; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      transition: transform 0.15s, box-shadow 0.15s;
      &:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    }
    .stat-card__icon { width: 40px; height: 40px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 15%, transparent); display:flex; align-items:center; justify-content:center; color:var(--accent); ::ng-deep svg{width:20px;height:20px;} }
    .stat-card__body { flex:1; }
    .stat-card__value { font-size: 22px; font-weight: 700; color: var(--text-primary); }
    .stat-card__label { font-size: 12px; color: var(--text-muted); }
    .stat-card__trend { font-size: 11px; color: var(--text-muted); }
    .trend--up { color: #34d399 !important; }

    .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
    .glass-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .glass-card h3 { margin: 0 0 16px; font-size: 14px; font-weight: 600; color: var(--text-primary); }

    .activity-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; }
    .activity-item { display:flex; align-items:flex-start; gap:10px; }
    .activity-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:4px; }
    .activity-text { font-size:13px; color:var(--text-primary); }
    .activity-time { font-size:11px; color:var(--text-muted); margin-top:2px; }

    .bar-chart { display:flex; align-items:flex-end; gap:8px; height:120px; padding-top:8px; }
    .bar-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; height:100%; justify-content:flex-end; }
    .bar { width:100%; border-radius:4px 4px 0 0; transition: height 0.6s ease; min-height:4px; }
    .bar-label { font-size:10px; color:var(--text-muted); }

    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  `],
})
export class DashboardComponent {
  readonly i18n = inject(I18nService);

  // Placeholder figures — this screen is not wired to the API yet. Labels are held as
  // translation keys and resolved in the template so they follow the language toggle.
  stats = [
    { labelKey: 'dashboard.stat.users', value: '12,450', change: '8.2%', up: true, color: '#6366f1', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>` },
    { labelKey: 'dashboard.stat.revenue', value: '$84,200', change: '12.5%', up: true, color: '#34d399', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>` },
    { labelKey: 'dashboard.stat.orders', value: '3,620', change: '3.1%', up: false, color: '#f59e0b', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>` },
    { labelKey: 'dashboard.stat.conversion', value: '24.8%', change: '1.4%', up: true, color: '#8b5cf6', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>` },
  ];

  activities = [
    { key: 'dashboard.activity.newUser', timeKey: 'time.minutesAgo', n: 2,  color: '#6366f1' },
    { key: 'dashboard.activity.shipped', timeKey: 'time.minutesAgo', n: 15, color: '#34d399' },
    { key: 'dashboard.activity.payment', timeKey: 'time.hoursAgo',   n: 1,  color: '#f59e0b' },
    { key: 'dashboard.activity.report',  timeKey: 'time.hoursAgo',   n: 3,  color: '#8b5cf6' },
    { key: 'dashboard.activity.update',  timeKey: 'time.hoursAgo',   n: 5,  color: '#06b6d4' },
  ];

  bars = [
    { month: 1, h: 55, color: 'linear-gradient(180deg,#6366f1,#8b5cf6)' },
    { month: 2, h: 70, color: 'linear-gradient(180deg,#6366f1,#8b5cf6)' },
    { month: 3, h: 45, color: 'linear-gradient(180deg,#6366f1,#8b5cf6)' },
    { month: 4, h: 85, color: 'linear-gradient(180deg,#34d399,#06b6d4)' },
    { month: 5, h: 60, color: 'linear-gradient(180deg,#6366f1,#8b5cf6)' },
    { month: 6, h: 90, color: 'linear-gradient(180deg,#f59e0b,#ef4444)' },
    { month: 7, h: 78, color: 'linear-gradient(180deg,#6366f1,#8b5cf6)' },
  ];
}
