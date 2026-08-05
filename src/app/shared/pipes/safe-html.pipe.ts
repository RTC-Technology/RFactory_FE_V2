import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Trusts static, developer-authored icon SVG strings for `[innerHTML]` binding.
 * Angular's default sanitizer strips every SVG element (svg/path/circle/...
 * aren't in its safe-elements allowlist), so without this every inline icon
 * renders as an empty box. Only use on content that is NOT user-supplied.
 */
@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value ?? '');
  }
}
