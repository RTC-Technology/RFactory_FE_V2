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
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { LabelTemplateApiService } from '../../core/services/label-template-api.service';
import { PackingSpecificationApiService } from '../../core/services/packing-specification-api.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { I18nService } from '../../core/services/i18n.service';
import {
  PACKAGING_TYPES,
  PACKING_STATUSES,
  PackingSpecificationDto,
  PackingSpecificationRequest,
} from '../../domain/models/packing-specification.model';

@Component({
  selector: 'app-packing-specification',
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
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './packing-specification.component.html',
  styleUrl: './packing-specification.component.scss',
})
export class PackingSpecificationComponent extends PermissionAwarePage implements OnInit {
  private readonly specApi = inject(PackingSpecificationApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly unitApi = inject(UnitApiService);
  private readonly templateApi = inject(LabelTemplateApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly packagingTypes = PACKAGING_TYPES;
  readonly statusOptions = PACKING_STATUSES;

  readonly specs = this.specApi.items;
  readonly loading = this.specApi.loading;
  readonly products = this.productApi.items;
  readonly units = this.unitApi.items;
  readonly templates = this.templateApi.items;

  // Selection
  readonly selected = signal<PackingSpecificationDto | null>(null);

  // Table filter
  readonly table = viewChild<Table>('dt');
  readonly filterFields = ['specCode', 'specName', 'productCode', 'productName', 'packagingType', 'customerName'];

  // Dialog State
  readonly dialogOpen = signal<boolean>(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal<boolean>(false);
  readonly formError = signal<string>('');

  // Form Fields
  formSpecCode = signal<string>('');
  formSpecName = signal<string>('');
  formProductId = signal<number | null>(null);
  formCustomerCode = signal<string>('');
  formCustomerName = signal<string>('');
  formPackagingType = signal<string>('CARTON');
  formQuantityPerPack = signal<number>(50);
  formPackUnitId = signal<number | null>(null);

  formLengthMm = signal<number>(400);
  formWidthMm = signal<number>(300);
  formHeightMm = signal<number>(250);
  formVolumeM3 = signal<number>(0.03);
  formNetWeightKg = signal<number>(10);
  formGrossWeightKg = signal<number>(11.2);
  formTareWeightKg = signal<number>(1.2);

  formInnerPackQty = signal<number | null>(10);
  formMasterCartonQty = signal<number | null>(5);
  formPalletTi = signal<number | null>(8);
  formPalletHi = signal<number | null>(5);
  formTotalUnitsPerPallet = signal<number | null>(2000);

  formLabelTemplateId = signal<number | null>(null);
  formBarcode = signal<string>('');
  formPackagingMaterial = signal<string>('');
  formInstructions = signal<string>('');
  formIsDefault = signal<boolean>(false);
  formStatus = signal<string>('ACTIVE');

  // Hierarchy overview computed
  readonly hierarchySummary = computed(() => {
    const qtyPerPack = this.formQuantityPerPack() || 1;
    const inner = this.formInnerPackQty();
    const master = this.formMasterCartonQty();
    const ti = this.formPalletTi() || 0;
    const hi = this.formPalletHi() || 0;
    const cartonsPerPallet = ti * hi;
    const palletTotal = cartonsPerPallet > 0 ? cartonsPerPallet * qtyPerPack : 0;

    return {
      innerQty: inner,
      masterQty: master,
      cartonsPerPallet,
      palletTotal: this.formTotalUnitsPerPallet() || palletTotal,
    };
  });

  constructor() {
    super(PERMISSIONS.packingSpecification);
  }

  ngOnInit(): void {
    this.reload();
    this.productApi.load().subscribe();
    this.unitApi.load().subscribe();
    this.templateApi.load().subscribe();
  }

  reload(): void {
    this.specApi.load().subscribe({
      next: rows => {
        if (!this.selected() && rows.length > 0) {
          this.selected.set(rows[0]);
        }
      },
      error: () => this.messages.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load packing specifications.',
      }),
    });
  }

  applyFilter(val: string): void {
    this.table()?.filterGlobal(val, 'contains');
  }

  select(row?: PackingSpecificationDto | PackingSpecificationDto[] | null): void {
    if (row && !Array.isArray(row)) {
      this.selected.set(row);
    }
  }

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.formSpecCode.set('');
    this.formSpecName.set('');
    this.formProductId.set(null);
    this.formCustomerCode.set('');
    this.formCustomerName.set('');
    this.formPackagingType.set('CARTON');
    this.formQuantityPerPack.set(50);
    this.formPackUnitId.set(null);

    this.formLengthMm.set(450);
    this.formWidthMm.set(320);
    this.formHeightMm.set(280);
    this.recalculateVolume();

    this.formNetWeightKg.set(12.5);
    this.formGrossWeightKg.set(13.8);
    this.recalculateTare();

    this.formInnerPackQty.set(10);
    this.formMasterCartonQty.set(5);
    this.formPalletTi.set(8);
    this.formPalletHi.set(4);
    this.recalculatePallet();

    this.formLabelTemplateId.set(null);
    this.formBarcode.set('');
    this.formPackagingMaterial.set('5-ply Corrugated Carton, Polybag, Silica Gel');
    this.formInstructions.set('');
    this.formIsDefault.set(false);
    this.formStatus.set('ACTIVE');

    this.dialogOpen.set(true);
  }

  openEdit(item: PackingSpecificationDto): void {
    this.editingId.set(item.id);
    this.formError.set('');
    this.formSpecCode.set(item.specCode);
    this.formSpecName.set(item.specName);
    this.formProductId.set(item.productId ?? null);
    this.formCustomerCode.set(item.customerCode ?? '');
    this.formCustomerName.set(item.customerName ?? '');
    this.formPackagingType.set(item.packagingType);
    this.formQuantityPerPack.set(item.quantityPerPack);
    this.formPackUnitId.set(item.packUnitId ?? null);

    this.formLengthMm.set(item.lengthMm);
    this.formWidthMm.set(item.widthMm);
    this.formHeightMm.set(item.heightMm);
    this.formVolumeM3.set(item.volumeM3);

    this.formNetWeightKg.set(item.netWeightKg);
    this.formGrossWeightKg.set(item.grossWeightKg);
    this.formTareWeightKg.set(item.tareWeightKg);

    this.formInnerPackQty.set(item.innerPackQty ?? null);
    this.formMasterCartonQty.set(item.masterCartonQty ?? null);
    this.formPalletTi.set(item.palletTi ?? null);
    this.formPalletHi.set(item.palletHi ?? null);
    this.formTotalUnitsPerPallet.set(item.totalUnitsPerPallet ?? null);

    this.formLabelTemplateId.set(item.labelTemplateId ?? null);
    this.formBarcode.set(item.barcode ?? '');
    this.formPackagingMaterial.set(item.packagingMaterial ?? '');
    this.formInstructions.set(item.instructions ?? '');
    this.formIsDefault.set(item.isDefault);
    this.formStatus.set(item.status);

    this.dialogOpen.set(true);
  }

  recalculateVolume(): void {
    const l = this.formLengthMm() || 0;
    const w = this.formWidthMm() || 0;
    const h = this.formHeightMm() || 0;
    if (l > 0 && w > 0 && h > 0) {
      const vol = (l * w * h) / 1_000_000_000;
      this.formVolumeM3.set(Math.round(vol * 10000) / 10000);
    }
  }

  recalculateTare(): void {
    const gross = this.formGrossWeightKg() || 0;
    const net = this.formNetWeightKg() || 0;
    if (gross > net && net > 0) {
      this.formTareWeightKg.set(Math.round((gross - net) * 1000) / 1000);
    }
  }

  recalculatePallet(): void {
    const ti = this.formPalletTi() || 0;
    const hi = this.formPalletHi() || 0;
    const qty = this.formQuantityPerPack() || 0;
    if (ti > 0 && hi > 0 && qty > 0) {
      this.formTotalUnitsPerPallet.set(ti * hi * qty);
    }
  }

  save(): void {
    const code = this.formSpecCode().trim();
    const name = this.formSpecName().trim();

    if (!code) {
      this.formError.set('Specification Code is required.');
      return;
    }
    if (!name) {
      this.formError.set('Specification Name is required.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const body: PackingSpecificationRequest = {
      specCode: code,
      specName: name,
      productId: this.formProductId(),
      customerCode: this.formCustomerCode().trim() || null,
      customerName: this.formCustomerName().trim() || null,
      packagingType: this.formPackagingType(),
      quantityPerPack: this.formQuantityPerPack() || 1,
      packUnitId: this.formPackUnitId(),
      lengthMm: this.formLengthMm() || 0,
      widthMm: this.formWidthMm() || 0,
      heightMm: this.formHeightMm() || 0,
      volumeM3: this.formVolumeM3() || 0,
      netWeightKg: this.formNetWeightKg() || 0,
      grossWeightKg: this.formGrossWeightKg() || 0,
      tareWeightKg: this.formTareWeightKg() || 0,
      innerPackQty: this.formInnerPackQty(),
      masterCartonQty: this.formMasterCartonQty(),
      palletTi: this.formPalletTi(),
      palletHi: this.formPalletHi(),
      totalUnitsPerPallet: this.formTotalUnitsPerPallet(),
      labelTemplateId: this.formLabelTemplateId(),
      barcode: this.formBarcode().trim() || null,
      packagingMaterial: this.formPackagingMaterial().trim() || null,
      instructions: this.formInstructions().trim() || null,
      isDefault: this.formIsDefault(),
      status: this.formStatus(),
    };

    const id = this.editingId();
    const req$ = id ? this.specApi.update(id, body) : this.specApi.create(body);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this.messages.add({
          severity: 'success',
          summary: 'Success',
          detail: id ? 'Packing specification updated.' : 'Packing specification created.',
        });
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(err.error?.message || 'Failed to save specification.');
      },
    });
  }

  askDelete(item: PackingSpecificationDto): void {
    this.confirm.confirm({
      header: 'Delete Packing Specification',
      message: `Are you sure you want to delete specification "${item.specName}" (${item.specCode})?`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.specApi.remove(item.id).subscribe({
          next: () => {
            this.reload();
            this.messages.add({
              severity: 'success',
              summary: 'Deleted',
              detail: `Specification ${item.specCode} removed.`,
            });
          },
          error: () => this.messages.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete specification.',
          }),
        });
      },
    });
  }

  setDefault(item: PackingSpecificationDto): void {
    this.specApi.setDefault(item.id).subscribe({
      next: () => {
        this.reload();
        this.messages.add({
          severity: 'success',
          summary: 'Default Set',
          detail: `Specification "${item.specName}" is now default.`,
        });
      },
      error: () => this.messages.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to set default specification.',
      }),
    });
  }
}
