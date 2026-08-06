import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  ShiftBreakDto, ShiftBreakRequest, ShiftDto, ShiftRequest,
} from '../../domain/models/shift.model';
import { CrudApiService } from './crud-api.service';

@Injectable({ providedIn: 'root' })
export class ShiftApiService extends CrudApiService<ShiftDto, ShiftRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/shifts`;
}

@Injectable({ providedIn: 'root' })
export class ShiftBreakApiService extends CrudApiService<ShiftBreakDto, ShiftBreakRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/shift-breaks`;
}
