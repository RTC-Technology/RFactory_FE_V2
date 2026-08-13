import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  WarehouseDto, WarehouseRequest,
  WarehouseZoneDto, WarehouseZoneRequest,
  WarehouseLocationDto, WarehouseLocationRequest,
} from '../../domain/models/warehouse.model';
import { CrudApiService } from './crud-api.service';

@Injectable({ providedIn: 'root' })
export class WarehouseApiService extends CrudApiService<WarehouseDto, WarehouseRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse/warehouses`;
}

@Injectable({ providedIn: 'root' })
export class WarehouseZoneApiService extends CrudApiService<WarehouseZoneDto, WarehouseZoneRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse/zones`;
}

@Injectable({ providedIn: 'root' })
export class WarehouseLocationApiService extends CrudApiService<WarehouseLocationDto, WarehouseLocationRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse/locations`;
}
