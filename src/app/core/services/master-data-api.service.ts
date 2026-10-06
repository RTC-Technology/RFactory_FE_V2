import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AreaDto, AreaRequest,
  CustomerContactDto,
  CustomerContactRequest,
  CustomerDto,
  CustomerRequest,
  FactoryDto, FactoryRequest,
  LineDto, LineRequest,
  LotRuleDto,
  LotRuleRequest,
  LotRuleSequenceDto,
  LotRuleSequenceRequest,
  ProductLotRuleDto,
  ProductLotRuleRequest,
  SerialRuleDto,
  SerialRuleRequest,
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

@Injectable({ providedIn: 'root' })
export class CustomerApiService extends CrudApiService<CustomerDto, CustomerRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/customer`;
}

@Injectable({ providedIn: 'root' })
export class CustomerContactApiService extends CrudApiService<CustomerContactDto, CustomerContactRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/customer/contacts`;
}


//#region lot
@Injectable({ providedIn: 'root' })
export class LotRuleApiService extends CrudApiService<LotRuleDto, LotRuleRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/lot-rule`;
}

@Injectable({ providedIn: 'root' })
export class LotRuleSequenceApiService extends CrudApiService<LotRuleSequenceDto, LotRuleSequenceRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/lot-rule-sequence`;
}

@Injectable({ providedIn: 'root' })
export class ProductLotRuleApiService extends CrudApiService<ProductLotRuleDto, ProductLotRuleRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/product-lot-rule`;
}
//#endregion

//#region Serial
@Injectable({ providedIn: 'root' })
export class SerialRuleApiService extends CrudApiService<SerialRuleDto, SerialRuleRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/serial-rule`;
}
//#endregion
