import { Injectable } from '@angular/core';
import { CrudApiService } from './crud-api.service';
import { environment } from '../../../environments/environment';
import { LocationDto, LocationRequest, WarehouseDto, WarehouseRequest } from '../../domain/models/warehouse.model';

@Injectable({
  providedIn: 'root',
})
export class WarehouseApiService extends CrudApiService<WarehouseDto, WarehouseRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/warehouse`;
}


@Injectable({ providedIn: 'root' })
export class LocationApiService extends CrudApiService<LocationDto, LocationRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/location`;
}