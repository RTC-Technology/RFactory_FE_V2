import { Injectable, signal } from '@angular/core';
import { Lang, TRANSLATIONS } from '../i18n/translations';

const STORAGE_KEY = 'app:lang';
const DEFAULT_LANG: Lang = 'vi';

/**
 * Runtime translation backed by a signal, so switching language re-renders every
 * template that reads it without a reload.
 *
 * Deliberately not `@angular/localize`: that resolves messages at build time and ships
 * one bundle per locale, which cannot serve an in-app toggle.
 *
 * Templates call `i18n.t('key')` rather than piping through a filter — reading the
 * signal inside the expression is what makes the view react, and it avoids the
 * every-cycle cost of an impure pipe.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>(this._restore());
  readonly lang = this._lang.asReadonly();

  constructor() {
    this._applyDocumentLang();
  }

  setLang(lang: Lang): void {
    if (lang === this._lang()) return;
    this._lang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    this._applyDocumentLang();
  }

  toggle(): void {
    this.setLang(this._lang() === 'vi' ? 'en' : 'vi');
  }

  /**
   * Resolves `key` in the active language. `params` fill `{name}` placeholders.
   * An unknown key returns itself — loud enough to spot in review, quiet enough
   * not to break a screen over a missing string.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;

    const text = entry[this._lang()] ?? key;
    if (!params) return text;

    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match);
  }

  private _restore(): Lang {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'vi' || saved === 'en' ? saved : DEFAULT_LANG;
  }

  /** Keeps `<html lang>` truthful — screen readers and the browser's own translation
   *  prompt both read it. */
  private _applyDocumentLang(): void {
    document.documentElement.lang = this._lang();
  }
}
