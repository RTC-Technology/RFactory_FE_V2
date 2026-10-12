import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  ChangeMachineStatusRequest,
  LogMachineDefectRequest,
  MachineDefectLogDto,
  MachineRealtimeStatusDto,
  MachineReasonCodeDto,
  MachineReasonCodeRequest,
  MachineStatusDashboardSummaryDto,
  MachineStatusHistoryDto,
} from '../../domain/models/machine-status.model';

@Injectable({ providedIn: 'root' })
export class MachineStatusApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/equipment/machine-status`;

  readonly realtimeStatuses = signal<MachineRealtimeStatusDto[]>([]);
  readonly summary = signal<MachineStatusDashboardSummaryDto | null>(null);
  readonly reasons = signal<MachineReasonCodeDto[]>([]);
  readonly loading = signal<boolean>(false);

  loadRealtime(lineId?: number | null): Observable<MachineRealtimeStatusDto[]> {
    this.loading.set(true);
    let params = new HttpParams();
    if (lineId) {
      params = params.set('lineId', lineId.toString());
    }

    return this.http
      .get<ApiResponse<MachineRealtimeStatusDto[]>>(`${this.baseUrl}/realtime`, { params })
      .pipe(
        map(res => res.data ?? []),
        tap({
          next: list => {
            this.realtimeStatuses.set(list);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        })
      );
  }

  loadSummary(): Observable<MachineStatusDashboardSummaryDto> {
    return this.http
      .get<ApiResponse<MachineStatusDashboardSummaryDto>>(`${this.baseUrl}/summary`)
      .pipe(
        map(res => res.data),
        tap(sum => this.summary.set(sum))
      );
  }

  getMachineStatus(id: number): Observable<MachineRealtimeStatusDto> {
    return this.http
      .get<ApiResponse<MachineRealtimeStatusDto>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  changeStatus(request: ChangeMachineStatusRequest): Observable<MachineRealtimeStatusDto> {
    return this.http
      .post<ApiResponse<MachineRealtimeStatusDto>>(`${this.baseUrl}/change`, request)
      .pipe(map(res => res.data));
  }

  getHistory(
    machineId?: number | null,
    fromDate?: string | null,
    toDate?: string | null
  ): Observable<MachineStatusHistoryDto[]> {
    let params = new HttpParams();
    if (machineId) params = params.set('machineId', machineId.toString());
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);

    return this.http
      .get<ApiResponse<MachineStatusHistoryDto[]>>(`${this.baseUrl}/history`, { params })
      .pipe(map(res => res.data ?? []));
  }

  logDefect(request: LogMachineDefectRequest): Observable<MachineDefectLogDto> {
    return this.http
      .post<ApiResponse<MachineDefectLogDto>>(`${this.baseUrl}/defect`, request)
      .pipe(map(res => res.data));
  }

  getDefectLogs(
    machineId?: number | null,
    defectType?: string | null,
    fromDate?: string | null,
    toDate?: string | null
  ): Observable<MachineDefectLogDto[]> {
    let params = new HttpParams();
    if (machineId) params = params.set('machineId', machineId.toString());
    if (defectType) params = params.set('defectType', defectType);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);

    return this.http
      .get<ApiResponse<MachineDefectLogDto[]>>(`${this.baseUrl}/defect-logs`, { params })
      .pipe(map(res => res.data ?? []));
  }

  // ── Reason Codes ──────────────────────────────────────────

  loadReasons(type?: string | null): Observable<MachineReasonCodeDto[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);

    return this.http
      .get<ApiResponse<MachineReasonCodeDto[]>>(`${this.baseUrl}/reasons`, { params })
      .pipe(
        map(res => res.data ?? []),
        tap(list => this.reasons.set(list))
      );
  }

  getReasonById(id: number): Observable<MachineReasonCodeDto> {
    return this.http
      .get<ApiResponse<MachineReasonCodeDto>>(`${this.baseUrl}/reasons/${id}`)
      .pipe(map(res => res.data));
  }

  createReason(request: MachineReasonCodeRequest): Observable<MachineReasonCodeDto> {
    return this.http
      .post<ApiResponse<MachineReasonCodeDto>>(`${this.baseUrl}/reasons`, request)
      .pipe(map(res => res.data));
  }

  updateReason(id: number, request: MachineReasonCodeRequest): Observable<MachineReasonCodeDto> {
    return this.http
      .put<ApiResponse<MachineReasonCodeDto>>(`${this.baseUrl}/reasons/${id}`, request)
      .pipe(map(res => res.data));
  }

  deleteReason(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.baseUrl}/reasons/${id}`)
      .pipe(map(res => res.data));
  }
}
