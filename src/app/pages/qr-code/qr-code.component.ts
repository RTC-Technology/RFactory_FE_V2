import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { QrCodeApiService } from '../../core/services/qr-code-api.service';
import { I18nService } from '../../core/services/i18n.service';
import {
  QR_ENTITY_TYPES,
  QrCodeDto,
  QrItemLookupDto,
  QrScanResultDto,
} from '../../domain/models/qr-code.model';
import { QrGeneratorComponent } from '../../shared/components/qr-generator.component';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    SelectModule,
    InputTextModule,
    TagModule,
    ToastModule,
    TabsModule,
    CheckboxModule,
    DialogModule,
    QrGeneratorComponent,
  ],
  providers: [MessageService],
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss',
})
export class QrCodeComponent extends PermissionAwarePage implements OnInit {
  private readonly qrApi = inject(QrCodeApiService);
  private readonly messages = inject(MessageService);
  readonly i18n = inject(I18nService);

  // ── Tab State ─────────────────────────────────────────────────────────────
  activeTab = signal<'single' | 'batch' | 'scan'>('single');

  // ── Single Generator State ────────────────────────────────────────────────
  readonly entityTypes = QR_ENTITY_TYPES;
  selectedEntityType = signal<string>('PRODUCT');
  availableItems = signal<QrItemLookupDto[]>([]);
  selectedItem = signal<QrItemLookupDto | null>(null);

  customCode = signal<string>('');
  customTitle = signal<string>('');
  customSubtitle = signal<string>('');
  labelSize = signal<'sm' | 'md' | 'lg'>('md');

  readonly currentPayload = computed(() => {
    const item = this.selectedItem();
    if (this.selectedEntityType() === 'CUSTOM') {
      return this.customCode().trim() || 'RF:CUSTOM:0:SAMPLE-001';
    }
    if (item) {
      return item.payload;
    }
    return `RF:${this.selectedEntityType()}:0:CODE`;
  });

  readonly currentTitle = computed(() => {
    if (this.selectedEntityType() === 'CUSTOM') {
      return this.customTitle().trim() || 'CUSTOM QR LABEL';
    }
    return this.selectedItem()?.name || `${this.selectedEntityType()} LABEL`;
  });

  readonly currentSubtitle = computed(() => {
    if (this.selectedEntityType() === 'CUSTOM') {
      return this.customSubtitle().trim() || 'RF-MES QR Tag';
    }
    return this.selectedItem()?.description || `Code: ${this.selectedItem()?.code ?? 'N/A'}`;
  });

  // ── Batch Generator State ─────────────────────────────────────────────────
  batchEntityType = signal<string>('PRODUCT');
  batchItems = signal<QrItemLookupDto[]>([]);
  selectedBatchItems = signal<QrItemLookupDto[]>([]);
  batchQrCodes = signal<QrCodeDto[]>([]);
  batchLoading = signal<boolean>(false);

  // ── Scanner / Lookup State ────────────────────────────────────────────────
  scanInput = signal<string>('');
  scanResult = signal<QrScanResultDto | null>(null);
  scanning = signal<boolean>(false);
  isCameraActive = signal<boolean>(false);

  constructor() {
    super(PERMISSIONS.qrCode);
  }

  ngOnInit(): void {
    this.onEntityTypeChange('PRODUCT');
  }

  onEntityTypeChange(type: string): void {
    this.selectedEntityType.set(type);
    this.selectedItem.set(null);

    if (type === 'CUSTOM') {
      this.availableItems.set([]);
      return;
    }

    this.qrApi.getAvailableItems(type).subscribe({
      next: items => {
        this.availableItems.set(items);
        if (items.length > 0) {
          this.selectedItem.set(items[0]);
        }
      },
      error: () => this.availableItems.set([]),
    });
  }

  onBatchEntityTypeChange(type: string): void {
    this.batchEntityType.set(type);
    this.selectedBatchItems.set([]);
    this.batchQrCodes.set([]);

    this.qrApi.getAvailableItems(type).subscribe({
      next: items => this.batchItems.set(items),
      error: () => this.batchItems.set([]),
    });
  }

  generateBatch(): void {
    const selected = this.selectedBatchItems();
    if (selected.length === 0) {
      this.messages.add({
        severity: 'warn',
        summary: this.i18n.t('common.warning'),
        detail: 'Please select at least one item for batch generation.',
      });
      return;
    }

    this.batchLoading.set(true);
    const request = {
      entityType: this.batchEntityType(),
      entityIds: selected.map(i => i.id),
    };

    this.qrApi.batchGenerate(request).subscribe({
      next: codes => {
        this.batchQrCodes.set(codes);
        this.batchLoading.set(false);
        this.messages.add({
          severity: 'success',
          summary: this.i18n.t('common.success'),
          detail: `Generated ${codes.length} QR labels successfully.`,
        });
      },
      error: () => this.batchLoading.set(false),
    });
  }

  selectAllBatch(event: any): void {
    if (event.checked) {
      this.selectedBatchItems.set([...this.batchItems()]);
    } else {
      this.selectedBatchItems.set([]);
    }
  }

  // ── Scan & Lookup ─────────────────────────────────────────────────────────
  lookupScan(): void {
    const payload = this.scanInput().trim();
    if (!payload) {
      this.messages.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please enter or scan a QR payload string.',
      });
      return;
    }

    this.scanning.set(true);
    this.qrApi.scanAndLookup(payload).subscribe({
      next: res => {
        this.scanResult.set(res);
        this.scanning.set(false);
        if (res.found) {
          this.messages.add({
            severity: 'success',
            summary: 'Entity Found',
            detail: `${res.entityType}: ${res.title}`,
          });
        } else {
          this.messages.add({
            severity: 'info',
            summary: 'Lookup Result',
            detail: 'Payload parsed but entity not found in database.',
          });
        }
      },
      error: () => this.scanning.set(false),
    });
  }

  navigateToAction(route: string): void {
    if (route) {
      this.router.navigate([route]);
    }
  }

  // ── Print & Export ────────────────────────────────────────────────────────
  printLabel(): void {
    window.print();
  }

  copyPayload(payload: string): void {
    navigator.clipboard.writeText(payload);
    this.messages.add({
      severity: 'info',
      summary: 'Copied',
      detail: 'QR payload copied to clipboard.',
      life: 2000,
    });
  }
}
