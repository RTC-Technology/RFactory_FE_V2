import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page__header">
        <h1 class="page__title">{{ i18n.t('users.title') }}</h1>
        <p class="page__sub">{{ i18n.t('users.subtitle') }}</p>
      </div>

      <div class="users-table glass-card">
        <div class="table-toolbar">
          <input class="search-input" [placeholder]="i18n.t('users.search')" [(ngModel)]="searchQuery"/>
          <button class="btn btn--primary">{{ i18n.t('users.add') }}</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>{{ i18n.t('common.name') }}</th>
              <th>{{ i18n.t('users.email') }}</th>
              <th>{{ i18n.t('users.role') }}</th>
              <th>{{ i18n.t('common.status') }}</th>
              <th>{{ i18n.t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (user of filtered(); track user.email) {
              <tr>
                <td>
                  <div class="user-cell">
                    <div class="avatar" [style.background]="user.color">{{ user.name[0] }}</div>
                    {{ user.name }}
                  </div>
                </td>
                <td>{{ user.email }}</td>
                <td><span class="badge" [class]="'badge--' + user.role.toLowerCase()">{{ user.role }}</span></td>
                <td>
                  <span class="status" [class.status--active]="user.active">
                    {{ user.active ? i18n.t('users.active') : i18n.t('users.inactive') }}
                  </span>
                </td>
                <td>
                  <div class="actions">
                    <button class="icon-btn" title="Edit">✏️</button>
                    <button class="icon-btn" title="Delete">🗑️</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page { animation: fadeUp 0.3s ease; }
    .page__header { margin-bottom: 24px; }
    .page__title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page__sub { color: var(--text-muted); margin: 0; font-size: 13px; }
    .glass-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .table-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
    .search-input { flex:1; max-width:300px; padding:8px 14px; border-radius:8px; border:1px solid var(--border); background:var(--input-bg); color:var(--text-primary); font-size:13px; outline:none; &:focus { border-color:var(--accent); } }
    .btn { padding: 8px 18px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; &:hover{opacity:0.85;} }
    .btn--primary { background: var(--accent); color: #fff; }
    .table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); padding: 8px 12px; border-bottom: 1px solid var(--border); }
    td { padding: 12px 12px; font-size: 13px; color: var(--text-primary); border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--item-hover); }
    .user-cell { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 30px; height: 30px; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .badge { padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge--admin { background: color-mix(in srgb,#6366f1 20%,transparent); color: #6366f1; }
    .badge--editor { background: color-mix(in srgb,#f59e0b 20%,transparent); color: #f59e0b; }
    .badge--viewer { background: color-mix(in srgb,#6b7280 20%,transparent); color: #9ca3af; }
    .status { font-size: 12px; color: var(--text-muted); }
    .status--active { color: #34d399; }
    .status--active::before { content: '● '; }
    .actions { display: flex; gap: 4px; }
    .icon-btn { background: transparent; border: none; cursor: pointer; font-size: 14px; padding: 4px; border-radius: 4px; transition: background 0.15s; &:hover{background:var(--item-hover);} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
  `],
})
export class UsersComponent {
  readonly i18n = inject(I18nService);

  searchQuery = '';

  users = [
    { name: 'Nguyen Van A', email: 'nva@company.vn', role: 'Admin', active: true, color: '#6366f1' },
    { name: 'Tran Thi B', email: 'ttb@company.vn', role: 'Editor', active: true, color: '#8b5cf6' },
    { name: 'Le Van C', email: 'lvc@company.vn', role: 'Viewer', active: false, color: '#f59e0b' },
    { name: 'Pham Thi D', email: 'ptd@company.vn', role: 'Editor', active: true, color: '#34d399' },
    { name: 'Hoang Van E', email: 'hve@company.vn', role: 'Admin', active: true, color: '#06b6d4' },
    { name: 'Vo Thi F', email: 'vtf@company.vn', role: 'Viewer', active: false, color: '#ef4444' },
  ];

  filtered = computed(() =>
    this.users.filter(u =>
      u.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(this.searchQuery.toLowerCase())
    )
  );
}
