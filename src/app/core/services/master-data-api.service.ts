import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AreaDto, AreaRequest,
  FactoryDto, FactoryRequest,
  LineDto, LineRequest,
  SupplierDto,
  SupplierRequest,
} from '../../domain/models/master-data.model';
import { CrudApiService } from './crud-api.service';

/** Factory → Area → Line, the three levels of the plant hierarchy. */

@Injectable({ providedIn: 'root' })
export class FactoryApiService extends CrudApiService<FactoryDto, FactoryRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/factories`;
}

@Injectable({ providedIn: 'root' })
export class AreaApiService extends CrudApiService<AreaDto, AreaRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/areas`;
}

@Injectable({ providedIn: 'root' })
export class LineApiService extends CrudApiService<LineDto, LineRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/lines`;
}

@Injectable({ providedIn: 'root' })
export class SupplierApiService extends CrudApiService<SupplierDto, SupplierRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/supplier`;
}
