import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import { PackingNumberingRuleApiService } from '../../core/services/packing-numbering-rule-api.service';
import {
  DATE_FORMATS,
  GeneratePackingCodeRequest,
  GeneratedPackingCodesDto,
  PackingNumberingRuleDto,
  PackingNumberingRuleRequest,
  RESET_PERIODS,
  RULE_SCOPES,
} from '../../domain/models/packing-numbering-rule.model';

/**
 * Packing Numbering Rule Component
 * Manages prefix, date format, sequence padding, and reset triggers for packaging units.
 */
@Component({
  selector: 'app-packing-numbering-rule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    TagModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    CheckboxModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './packing-numbering-rule.component.html',
  styleUrl: './packing-numbering-rule.component.scss',
})
export class PackingNumberingRuleComponent extends PermissionAwarePage implements OnInit {
  private readonly ruleApi = inject(PackingNumberingRuleApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly scopes = RULE_SCOPES;
  readonly dateFormats = DATE_FORMATS;
  readonly resetPeriods = RESET_PERIODS;

  readonly rules = this.ruleApi.items;
  readonly loading = this.ruleApi.loading;

  // Selection
  readonly selected = signal<PackingNumberingRuleDto | null>(null);

  // Table filter
  readonly table = viewChild<Table>('dt');
  readonly filterFields = ['ruleCode', 'ruleName', 'targetScope', 'prefix', 'dateFormat'];

  // Add/Edit Dialog State
  readonly dialogOpen = signal<boolean>(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal<boolean>(false);
  readonly formError = signal<string>('');

  // Form Fields
  formRuleCode = signal<string>('');
  formRuleName = signal<string>('');
  formTargetScope = signal<string>('CARTON');
  formPrefix = signal<string>('CTN-');
  formSuffix = signal<string>('');
  formDateFormat = signal<string>('YYYYMMDD');
  formSequenceLength = signal<number>(4);
  formCurrentSequence = signal<number>(0);
  formResetPeriod = signal<string>('DAILY');
  formIncludeCheckDigit = signal<boolean>(false);
  formIsDefault = signal<boolean>(false);
  formIsActive = signal<boolean>(true);
  formDescription = signal<string>('');

  // Generation Modal State
  readonly genDialogOpen = signal<boolean>(false);
  readonly targetRuleForGen = signal<PackingNumberingRuleDto | null>(null);
  readonly genCount = signal<number>(1);
  readonly generating = signal<boolean>(false);
  readonly generatedResult = signal<GeneratedPackingCodesDto | null>(null);
  readonly copiedNotification = signal<boolean>(false);

  // Live Sample Preview for Form
  readonly liveFormPreview = computed(() => {
    const prefix = this.formPrefix() || '';
    const suffix = this.formSuffix() || '';
    const dateFormat = this.formDateFormat() || 'YYYYMMDD';
    const seqLen = Math.max(1, this.formSequenceLength() || 4);
    const curSeq = (this.formCurrentSequence() || 0) + 1;
    const includeCd = this.formIncludeCheckDigit();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const yy = String(year).slice(-2);

    let datePart = '';
    switch (dateFormat) {
      case 'YYYYMMDD':
        datePart = `${year}${month}${day}`;
        break;
      case 'YYMMDD':
        datePart = `${yy}${month}${day}`;
        break;
      case 'YYYYMM':
        datePart = `${year}${month}`;
        break;
      case 'YYWW': {
        const tempDate = new Date(now.getTime());
        tempDate.setHours(0, 0, 0, 0);
        tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
        const week1 = new Date(tempDate.getFullYear(), 0, 4);
        const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
        datePart = `${yy}W${String(weekNum).padStart(2, '0')}`;
        break;
      }
      case 'NONE':
      default:
        datePart = '';
        break;
    }

    const seqPart = String(curSeq).padStart(seqLen, '0');
    let base = `${prefix}${datePart}${seqPart}${suffix}`;

    if (includeCd) {
      const digits: number[] = [];
      for (const ch of base) {
        if (ch >= '0' && ch <= '9') {
          digits.push(Number(ch));
        }
      }
      if (digits.length === 0) {
        base += '0';
      } else {
        let sum = 0;
        let mul3 = true;
        for (let i = digits.length - 1; i >= 0; i--) {
          sum += digits[i] * (mul3 ? 3 : 1);
          mul3 = !mul3;
        }
        const rem = sum % 10;
        const cd = (10 - rem) % 10;
        base += String(cd);
      }
    }

    return base;
  });

  constructor() {
    super(PERMISSIONS.packingNumberingRule);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.ruleApi.load().subscribe({
      next: rows => {
        if (!this.selected() && rows.length > 0) {
          this.selected.set(rows[0]);
        } else if (this.selected()) {
          const match = rows.find(r => r.id === this.selected()!.id);
          this.selected.set(match || (rows.length > 0 ? rows[0] : null));
        }
      },
      error: () =>
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load packing numbering rules.',
        }),
    });
  }

  applyFilter(val: string): void {
    this.table()?.filterGlobal(val, 'contains');
  }

  select(row?: PackingNumberingRuleDto | PackingNumberingRuleDto[] | null): void {
    if (row && !Array.isArray(row)) {
      this.selected.set(row);
    }
  }

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.formRuleCode.set('');
    this.formRuleName.set('');
    this.formTargetScope.set('CARTON');
    this.formPrefix.set('CTN-');
    this.formSuffix.set('');
    this.formDateFormat.set('YYYYMMDD');
    this.formSequenceLength.set(4);
    this.formCurrentSequence.set(0);
    this.formResetPeriod.set('DAILY');
    this.formIncludeCheckDigit.set(false);
    this.formIsDefault.set(false);
    this.formIsActive.set(true);
    this.formDescription.set('');
    this.dialogOpen.set(true);
  }

  openEdit(rule: PackingNumberingRuleDto): void {
    this.editingId.set(rule.id);
    this.formError.set('');
    this.formRuleCode.set(rule.ruleCode);
    this.formRuleName.set(rule.ruleName);
    this.formTargetScope.set(rule.targetScope);
    this.formPrefix.set(rule.prefix || '');
    this.formSuffix.set(rule.suffix || '');
    this.formDateFormat.set(rule.dateFormat);
    this.formSequenceLength.set(rule.sequenceLength);
    this.formCurrentSequence.set(rule.currentSequence);
    this.formResetPeriod.set(rule.resetPeriod);
    this.formIncludeCheckDigit.set(rule.includeCheckDigit);
    this.formIsDefault.set(rule.isDefault);
    this.formIsActive.set(rule.isActive);
    this.formDescription.set(rule.description || '');
    this.dialogOpen.set(true);
  }

  onScopeChanged(newScope: string): void {
    this.formTargetScope.set(newScope);
    // Suggest standard industrial prefixes based on scope when creating new
    if (!this.editingId()) {
      switch (newScope) {
        case 'CARTON':
          this.formPrefix.set('CTN-');
          this.formSequenceLength.set(4);
          this.formDateFormat.set('YYYYMMDD');
          break;
        case 'PALLET':
          this.formPrefix.set('PLT-');
          this.formSequenceLength.set(5);
          this.formDateFormat.set('YYMMDD');
          this.formIncludeCheckDigit.set(true);
          break;
        case 'INNER_BOX':
          this.formPrefix.set('BOX-');
          this.formSequenceLength.set(4);
          this.formDateFormat.set('YYYYMM');
          break;
        case 'SPEC':
          this.formPrefix.set('PK-SPEC-');
          this.formSequenceLength.set(4);
          this.formDateFormat.set('NONE');
          this.formResetPeriod.set('NEVER');
          break;
        case 'LOT':
          this.formPrefix.set('LOT-');
          this.formSequenceLength.set(3);
          this.formDateFormat.set('YYWW');
          break;
      }
    }
  }

  save(): void {
    const code = this.formRuleCode().trim();
    const name = this.formRuleName().trim();

    if (!code) {
      this.formError.set('Rule Code is required.');
      return;
    }
    if (!name) {
      this.formError.set('Rule Name is required.');
      return;
    }

    const payload: PackingNumberingRuleRequest = {
      ruleCode: code,
      ruleName: name,
      targetScope: this.formTargetScope(),
      prefix: this.formPrefix() ? this.formPrefix().trim() : null,
      suffix: this.formSuffix() ? this.formSuffix().trim() : null,
      dateFormat: this.formDateFormat(),
      sequenceLength: this.formSequenceLength() || 4,
      currentSequence: this.formCurrentSequence() || 0,
      resetPeriod: this.formResetPeriod(),
      includeCheckDigit: this.formIncludeCheckDigit(),
      isDefault: this.formIsDefault(),
      isActive: this.formIsActive(),
      description: this.formDescription() ? this.formDescription().trim() : null,
    };

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const call$ = id ? this.ruleApi.update(id, payload) : this.ruleApi.create(payload);

    call$.subscribe({
      next: res => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Success',
          detail: id ? 'Numbering rule updated.' : 'Numbering rule created.',
        });
        this.reload();
      },
      error: err => {
        this.saving.set(false);
        const msg = err?.error?.message || err?.error || 'Failed to save numbering rule.';
        this.formError.set(msg);
      },
    });
  }

  confirmSetDefault(rule: PackingNumberingRuleDto): void {
    this.confirm.confirm({
      message: `Set "${rule.ruleName}" as the primary default rule for scope [${rule.targetScope}]?`,
      header: 'Confirm Set Default',
      icon: 'pi pi-star',
      accept: () => {
        this.ruleApi.setDefault(rule.id).subscribe({
          next: () => {
            this.messages.add({
              severity: 'success',
              summary: 'Default Updated',
              detail: `Rule "${rule.ruleCode}" is now default for ${rule.targetScope}.`,
            });
            this.reload();
          },
          error: () =>
            this.messages.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to set default rule.',
            }),
        });
      },
    });
  }

  confirmDelete(rule: PackingNumberingRuleDto): void {
    this.confirm.confirm({
      message: `Are you sure you want to delete numbering rule "${rule.ruleCode}"? This cannot be undone.`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.ruleApi.remove(rule.id).subscribe({
          next: () => {
            this.messages.add({
              severity: 'success',
              summary: 'Deleted',
              detail: `Rule "${rule.ruleCode}" removed.`,
            });
            if (this.selected()?.id === rule.id) {
              this.selected.set(null);
            }
            this.reload();
          },
          error: () =>
            this.messages.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete rule.',
            }),
        });
      },
    });
  }

  // ── Code Generation Modal ──────────────────────────────────────
  openGenerator(rule: PackingNumberingRuleDto): void {
    this.targetRuleForGen.set(rule);
    this.genCount.set(1);
    this.generatedResult.set(null);
    this.copiedNotification.set(false);
    this.genDialogOpen.set(true);
  }

  runGenerate(): void {
    const rule = this.targetRuleForGen();
    if (!rule) return;

    const count = Math.min(50, Math.max(1, this.genCount()));
    const req: GeneratePackingCodeRequest = {
      ruleId: rule.id,
      targetScope: rule.targetScope,
      count,
    };

    this.generating.set(true);
    this.ruleApi.generateCodes(req).subscribe({
      next: res => {
        this.generating.set(false);
        this.generatedResult.set(res);
        this.messages.add({
          severity: 'success',
          summary: 'Codes Generated',
          detail: `Generated ${res.generatedCodes.length} serial code(s). Sequence updated.`,
        });
        // Silently refresh list to update sequence count
        this.reload();
      },
      error: err => {
        this.generating.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Generation Failed',
          detail: err?.error?.message || 'Could not generate codes.',
        });
      },
    });
  }

  copyCodesToClipboard(): void {
    const res = this.generatedResult();
    if (!res || !res.generatedCodes.length) return;

    const text = res.generatedCodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.copiedNotification.set(true);
      setTimeout(() => this.copiedNotification.set(false), 2000);
      this.messages.add({
        severity: 'info',
        summary: 'Copied',
        detail: `${res.generatedCodes.length} code(s) copied to clipboard.`,
      });
    });
  }

  copySingleCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.messages.add({
        severity: 'info',
        summary: 'Copied',
        detail: `Code "${code}" copied.`,
      });
    });
  }

  goToPackingSpecifications(): void {
    this.router.navigate(['/packing-specifications']);
  }

  getScopeBadge(scope: string): { label: string; icon: string; severity: 'info' | 'success' | 'warn' | 'secondary' | 'danger' } {
    switch (scope) {
      case 'CARTON':
        return { label: 'Master Carton', icon: 'pi pi-inbox', severity: 'info' };
      case 'PALLET':
        return { label: 'Pallet Container', icon: 'pi pi-database', severity: 'success' };
      case 'INNER_BOX':
        return { label: 'Inner Box', icon: 'pi pi-box', severity: 'warn' };
      case 'SPEC':
        return { label: 'Specification Code', icon: 'pi pi-file', severity: 'secondary' };
      case 'LOT':
        return { label: 'Lot / Batch', icon: 'pi pi-tags', severity: 'danger' };
      default:
        return { label: scope, icon: 'pi pi-tag', severity: 'info' };
    }
  }

  getResetPeriodLabel(period: string): string {
    switch (period) {
      case 'DAILY':
        return 'Daily (Midnight)';
      case 'MONTHLY':
        return 'Monthly (1st)';
      case 'YEARLY':
        return 'Yearly (Jan 1)';
      case 'NEVER':
        return 'Never (Continuous)';
      default:
        return period;
    }
  }
}
