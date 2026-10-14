import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  QrBatchPrintRequest,
  QrCodeDto,
  QrCodeGenerateRequest,
  QrItemLookupDto,
  QrScanRequest,
  QrScanResultDto,
} from '../../domain/models/qr-code.model';

@Injectable({ providedIn: 'root' })
export class QrCodeApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qrcode`;

  generate(request: QrCodeGenerateRequest): Observable<QrCodeDto> {
    return this.http
      .post<ApiResponse<QrCodeDto>>(`${this.baseUrl}/generate`, request)
      .pipe(map(res => res.data));
  }

  scanAndLookup(payload: string): Observable<QrScanResultDto> {
    const body: QrScanRequest = { payload };
    return this.http
      .post<ApiResponse<QrScanResultDto>>(`${this.baseUrl}/lookup`, body)
      .pipe(map(res => res.data));
  }

  getAvailableItems(entityType: string): Observable<QrItemLookupDto[]> {
    return this.http
      .get<ApiResponse<QrItemLookupDto[]>>(`${this.baseUrl}/available-items/${entityType}`)
      .pipe(map(res => res.data));
  }

  batchGenerate(request: QrBatchPrintRequest): Observable<QrCodeDto[]> {
    return this.http
      .post<ApiResponse<QrCodeDto[]>>(`${this.baseUrl}/batch-generate`, request)
      .pipe(map(res => res.data));
  }
}
