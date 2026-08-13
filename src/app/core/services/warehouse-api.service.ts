import { Injectable } from '@angular/core';
import { CrudApiService } from './crud-api.service';
import { environment } from '../../../environments/environment';
import {
  LocationDto, LocationRequest, WarehouseDto, WarehouseRequest, ZoneDto, ZoneRequest,
} from '../../domain/models/warehouse.model';

@Injectable({ providedIn: 'root' })
export class WarehouseApiService extends CrudApiService<WarehouseDto, WarehouseRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse/warehouses`;
}

@Injectable({ providedIn: 'root' })
export class ZoneApiService extends CrudApiService<ZoneDto, ZoneRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse/zones`;
}

@Injectable({ providedIn: 'root' })
export class LocationApiService extends CrudApiService<LocationDto, LocationRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse/locations`;
}
