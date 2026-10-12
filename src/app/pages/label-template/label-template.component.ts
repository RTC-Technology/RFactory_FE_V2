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
import { ToastModule } from 'primeng/toast';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { LabelTemplateApiService } from '../../core/services/label-template-api.service';
import { I18nService } from '../../core/services/i18n.service';
import {
  DEFAULT_FIELDS_BY_ENTITY,
  LabelFieldConfig,
  LabelTemplateDto,
  LabelTemplateRequest,
  TEMPLATE_ENTITY_TYPES,
} from '../../domain/models/label-template.model';
import { QrGeneratorComponent } from '../../shared/components/qr-generator.component';

@Component({
  selector: 'app-label-template',
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
    CheckboxModule,
    QrGeneratorComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './label-template.component.html',
  styleUrl: './label-template.component.scss',
})
export class LabelTemplateComponent extends PermissionAwarePage implements OnInit {
  private readonly templateApi = inject(LabelTemplateApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly entityTypes = TEMPLATE_ENTITY_TYPES;
  readonly templates = this.templateApi.items;
  readonly loading = this.templateApi.loading;

  // Selected row in table
  readonly selected = signal<LabelTemplateDto | null>(null);

  // Filter
  readonly table = viewChild<Table>('dt');
  readonly filterFields = ['templateCode', 'templateName', 'entityType'];

  // Editor Dialog State
  readonly editorOpen = signal<boolean>(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal<boolean>(false);
  readonly formError = signal<string>('');

  // Form State
  formTemplateCode = signal<string>('');
  formTemplateName = signal<string>('');
  formEntityType = signal<'PRODUCT' | 'MACHINE' | 'LOCATION' | 'EMPLOYEE'>('PRODUCT');
  formWidthMm = signal<number>(70);
  formHeightMm = signal<number>(50);
  formOrientation = signal<'LANDSCAPE' | 'PORTRAIT'>('LANDSCAPE');
  formIsDefault = signal<boolean>(false);
  formIsActive = signal<boolean>(true);
  formHeaderText = signal<string>('R-FACTORY MES');
  formFooterText = signal<string>('QC CERTIFIED & VERIFIED');
  formShowQr = signal<boolean>(true);
  formShowBarcode = signal<boolean>(false);
  formShowLogo = signal<boolean>(true);
  formShowBorder = signal<boolean>(true);
  formQrSizePx = signal<number>(140);
  formFields = signal<LabelFieldConfig[]>([]);

  // Sample data for live preview
  readonly sampleData = computed(() => {
    const type = this.formEntityType();
    switch (type) {
      case 'PRODUCT':
        return {
          code: 'PROD-CNC-0042',
          name: 'High Precision Rotor Blade',
          spec: 'Titanium Grade 5 | 120mm',
          date: new Date().toISOString().slice(0, 10),
          payload: 'RF:PRODUCT:42:PROD-CNC-0042',
        };
      case 'MACHINE':
        return {
          code: 'MAC-MILL-05',
          name: '5-Axis CNC Milling Center',
          model: 'DMG MORI DMU 50 (2024)',
          line: 'Line #3 - Machining Cell',
          payload: 'RF:MACHINE:5:MAC-MILL-05',
        };
      case 'LOCATION':
        return {
          code: 'LOC-Z1-A04-R2',
          name: 'Rack 2, Shelf 4, Bin B',
          zone: 'Zone 1 - Raw Materials',
          capacity: 'Max: 1,500 KG',
          payload: 'RF:LOCATION:14:LOC-Z1-A04-R2',
        };
      case 'EMPLOYEE':
        return {
          code: 'EMP-0089',
          name: 'Nguyen Van An',
          position: 'Senior CNC Specialist',
          department: 'Precision Manufacturing',
          payload: 'RF:EMPLOYEE:89:EMP-0089',
        };
    }
  });

  constructor() {
    super(PERMISSIONS.labelTemplate);
  }

  ngOnInit(): void {
    this.reload();
  }

  goToQrGenerator(): void {
    this.router.navigate(['/qr-code']);
  }

  reload(): void {
    this.templateApi.load().subscribe({
      next: rows => {
        if (!this.selected() && rows.length > 0) {
          this.selected.set(rows[0]);
        }
      },
      error: () => this.messages.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load label templates.',
      }),
    });
  }

  applyFilter(val: string): void {
    this.table()?.filterGlobal(val, 'contains');
  }

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.formTemplateCode.set('');
    this.formTemplateName.set('');
    this.formEntityType.set('PRODUCT');
    this.formWidthMm.set(70);
    this.formHeightMm.set(50);
    this.formOrientation.set('LANDSCAPE');
    this.formIsDefault.set(false);
    this.formIsActive.set(true);
    this.formHeaderText.set('R-FACTORY MES');
    this.formFooterText.set('QC VERIFIED TAG');
    this.formShowQr.set(true);
    this.formShowBarcode.set(false);
    this.formShowLogo.set(true);
    this.formShowBorder.set(true);
    this.formQrSizePx.set(130);
    this.formFields.set(JSON.parse(JSON.stringify(DEFAULT_FIELDS_BY_ENTITY['PRODUCT'])));
    this.editorOpen.set(true);
  }

  openEdit(tmpl: LabelTemplateDto): void {
    this.editingId.set(tmpl.id);
    this.formError.set('');
    this.formTemplateCode.set(tmpl.templateCode);
    this.formTemplateName.set(tmpl.templateName);
    this.formEntityType.set(tmpl.entityType);
    this.formWidthMm.set(tmpl.widthMm);
    this.formHeightMm.set(tmpl.heightMm);
    this.formOrientation.set(tmpl.orientation);
    this.formIsDefault.set(tmpl.isDefault);
    this.formIsActive.set(tmpl.isActive);
    this.formHeaderText.set(tmpl.headerText ?? '');
    this.formFooterText.set(tmpl.footerText ?? '');
    this.formShowQr.set(tmpl.showQr);
    this.formShowBarcode.set(tmpl.showBarcode);
    this.formShowLogo.set(tmpl.showLogo);
    this.formShowBorder.set(tmpl.showBorder);
    this.formQrSizePx.set(tmpl.qrSizePx);

    try {
      if (tmpl.fieldsConfigJson) {
        this.formFields.set(JSON.parse(tmpl.fieldsConfigJson));
      } else {
        this.formFields.set(JSON.parse(JSON.stringify(DEFAULT_FIELDS_BY_ENTITY[tmpl.entityType] ?? [])));
      }
    } catch {
      this.formFields.set(JSON.parse(JSON.stringify(DEFAULT_FIELDS_BY_ENTITY[tmpl.entityType] ?? [])));
    }

    this.editorOpen.set(true);
  }

  duplicate(tmpl: LabelTemplateDto): void {
    this.openEdit(tmpl);
    this.editingId.set(null);
    this.formTemplateCode.set(`${tmpl.templateCode}-COPY`);
    this.formTemplateName.set(`${tmpl.templateName} (Copy)`);
    this.formIsDefault.set(false);
  }

  onEntityTypeChange(type: 'PRODUCT' | 'MACHINE' | 'LOCATION' | 'EMPLOYEE'): void {
    this.formEntityType.set(type);
    this.formFields.set(JSON.parse(JSON.stringify(DEFAULT_FIELDS_BY_ENTITY[type] ?? [])));
  }

  save(): void {
    const code = this.formTemplateCode().trim();
    const name = this.formTemplateName().trim();

    if (!code) {
      this.formError.set('Template Code is required.');
      return;
    }
    if (!name) {
      this.formError.set('Template Name is required.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const body: LabelTemplateRequest = {
      templateCode: code,
      templateName: name,
      entityType: this.formEntityType(),
      widthMm: this.formWidthMm(),
      heightMm: this.formHeightMm(),
      orientation: this.formOrientation(),
      isDefault: this.formIsDefault(),
      isActive: this.formIsActive(),
      headerText: this.formHeaderText().trim() || null,
      footerText: this.formFooterText().trim() || null,
      showQr: this.formShowQr(),
      showBarcode: this.formShowBarcode(),
      showLogo: this.formShowLogo(),
      showBorder: this.formShowBorder(),
      qrSizePx: this.formQrSizePx(),
      fieldsConfigJson: JSON.stringify(this.formFields()),
    };

    const id = this.editingId();
    const req$ = id ? this.templateApi.update(id, body) : this.templateApi.create(body);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.reload();
        this.messages.add({
          severity: 'success',
          summary: 'Success',
          detail: id ? 'Template updated successfully.' : 'Template created successfully.',
        });
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(err.error?.message || 'Failed to save label template.');
      },
    });
  }

  askDelete(tmpl: LabelTemplateDto): void {
    this.confirm.confirm({
      header: 'Delete Label Template',
      message: `Are you sure you want to delete template "${tmpl.templateName}" (${tmpl.templateCode})?`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.templateApi.remove(tmpl.id).subscribe({
          next: () => {
            this.reload();
            this.messages.add({
              severity: 'success',
              summary: 'Deleted',
              detail: `Template ${tmpl.templateCode} removed.`,
            });
          },
          error: () => this.messages.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete template.',
          }),
        });
      },
    });
  }

  setDefault(tmpl: LabelTemplateDto): void {
    this.templateApi.setDefault(tmpl.id).subscribe({
      next: () => {
        this.reload();
        this.messages.add({
          severity: 'success',
          summary: 'Default Template Set',
          detail: `"${tmpl.templateName}" is now the default for ${tmpl.entityType}.`,
        });
      },
      error: () => this.messages.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to set default template.',
      }),
    });
  }

  printTest(): void {
    window.print();
  }

  getSampleFieldValue(key: string): string {
    const s = this.sampleData() as any;
    return s[key] ?? `[${key}]`;
  }
}
