import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';

/**
 * Renders a menu/tab icon from either form `MenuItem.icon`/`Tab.icon` can hold:
 * a path/URL ("/assets/icons/x.svg", "https://…") → `<img>`, or inline SVG
 * markup ("<svg …>…</svg>") → sanitized innerHTML. Detected by whether the
 * value starts with '<' — good enough since nothing else legitimately does.
 *
 * Signal inputs + OnPush: this component is instantiated dozens of times
 * across the shell (sidebar, tabs, topbar) and re-renders on every keystroke
 * anywhere in a zone.js app otherwise — memoizing `isMarkup` via `computed()`
 * and gating re-checks on actual input changes keeps that cost near-zero.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SafeHtmlPipe],
  template: `
    @if (isMarkup()) {
      <span [innerHTML]="value() | safeHtml"></span>
    } @else if (value()) {
      <img [src]="value()" [alt]="alt()" />
    }
  `,
  styles: [`
    :host { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    img { width: 100%; height: 100%; object-fit: contain; }
  `],
})
export class IconComponent {
  readonly value = input<string | null | undefined>('');
  readonly alt = input('');

  readonly isMarkup = computed(() => !!this.value()?.trimStart().startsWith('<'));
}
