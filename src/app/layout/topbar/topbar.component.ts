import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/components/icon.component';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, IconComponent, ClickOutsideDirective],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly currentUser = this.authService.currentUser;
  // ── Theme ──────────────────────────────────────────────────────────────
  isDark = signal(false);

  ngOnInit(): void { this._applyTheme(); }

  toggleTheme(): void {
    const flip = () => {
      this.isDark.update(v => !v);
      this._applyTheme();
    };

    // A view transition cross-fades one snapshot of the page against another on the
    // compositor, so the work is the same whether the screen holds a handful of
    // elements or a full table — unlike per-element CSS transitions, which is what the
    // old universal rule in styles.scss did (see the note there).
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || this._prefersReducedMotion()) {
      flip();
      return;
    }

    doc.startViewTransition(flip);
  }

  private _prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private _applyTheme(): void {
    if (this.isDark()) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // ── Notifications ──────────────────────────────────────────────────────
  notifOpen = false;
  notifCount = signal(3);
  /** Demo feed — text and relative time are resolved at render so they follow the
   *  active language rather than freezing whatever was set at construction. */
  notifications = [
    { key: 'notif.newUser',         timeKey: 'time.minutesAgo', n: 2,  color: '#6366f1' },
    { key: 'notif.orderShipped',    timeKey: 'time.minutesAgo', n: 15, color: '#34d399' },
    { key: 'notif.paymentReceived', timeKey: 'time.hoursAgo',   n: 1,  color: '#f59e0b' },
  ];

  // ── Profile ────────────────────────────────────────────────────────────
  profileOpen = false;
  profileMenu = [
    {
      id: 'profile' as const, labelKey: 'topbar.profile', danger: false,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    },
    {
      id: 'account' as const, labelKey: 'topbar.accountSettings', danger: false,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a1 1 0 0 0-1.41 0l-1.07 1.07a7 7 0 0 0-9.18 0L6.34 4.93A1 1 0 0 0 4.93 6.34l1.07 1.07a7 7 0 0 0 0 9.18l-1.07 1.07a1 1 0 0 0 1.41 1.41l1.07-1.07a7 7 0 0 0 9.18 0l1.07 1.07a1 1 0 0 0 1.41-1.41l-1.07-1.07a7 7 0 0 0 0-9.18l1.07-1.07a1 1 0 0 0 0-1.41z"/></svg>`,
    },
    {
      id: 'signout' as const, labelKey: 'topbar.signOut', danger: true,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    },
  ];

  onProfileAction(id: 'profile' | 'account' | 'signout'): void {
    this.profileOpen = false;
    if (id === 'signout') this.authService.logout();
    // 'profile' / 'account' have no dedicated pages yet — no-op for now.
  }
}
