import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AreaDto, AreaRequest,
  CustomerContactDto,
  CustomerContactRequest,
  CustomerDto,
  CustomerRequest,
  FactoryDto, FactoryRequest,
  FailureCodeDto,
  FailureCodeRequest,
  FailureGroupDto,
  FailureGroupRequest,
  LineDto, LineRequest,
  LotRuleDto,
  LotRuleRequest,
  LotRuleSequenceDto,
  LotRuleSequenceRequest,
  MaintenanceChecklistDto,
  MaintenanceChecklistItemDto,
  MaintenanceChecklistItemRequest,
  MaintenanceChecklistRequest,
  MaintenanceOrderChecklistDto,
  MaintenanceOrderChecklistItemDto,
  MaintenanceOrderChecklistItemRequest,
  MaintenanceOrderChecklistRequest,
  MaintenanceOrderDto,
  MaintenanceOrderRequest,
  MaintenancePlanDto,
  MaintenancePlanRequest,
  MaintenanceTypeDto,
  MaintenanceTypeRequest,
  ProductLotRuleDto,
  ProductLotRuleRequest,
  SerialRuleDto,
  SerialRuleRequest,
  SupplierDto,
  SupplierRequest,
  TraceabilityRuleDto,
  TraceabilityRuleItemDto,
  TraceabilityRuleItemRequest,
  TraceabilityRuleRequest,
  TraceabilityTypeDto,
  TraceabilityTypeRequest,
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

//#region traceability
@Injectable({ providedIn: 'root' })
export class TraceabilityRuleApiService extends CrudApiService<TraceabilityRuleDto, TraceabilityRuleRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/traceability-rule`;
}
@Injectable({ providedIn: 'root' })
export class TraceabilityRuleItemApiService extends CrudApiService<TraceabilityRuleItemDto, TraceabilityRuleItemRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/traceability-rule/items`;
}
@Injectable({ providedIn: 'root' })
export class TraceabilityTypeApiService extends CrudApiService<TraceabilityTypeDto, TraceabilityTypeRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/traceability/types`;
}
//#endregion

//#region  maintenance
@Injectable({ providedIn: 'root' })
export class MaintenanceTypeApiService extends CrudApiService<MaintenanceTypeDto, MaintenanceTypeRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/maintenance-type`;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceChecklistApiService extends CrudApiService<MaintenanceChecklistDto, MaintenanceChecklistRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/maintenance-checklist`;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceChecklistItemApiService extends CrudApiService<MaintenanceChecklistItemDto, MaintenanceChecklistItemRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/maintenance-checklist/items`;
}

@Injectable({ providedIn: 'root' })
export class MaintenancePlanApiService extends CrudApiService<MaintenancePlanDto, MaintenancePlanRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/maintenance-plan`;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceOrderApiService extends CrudApiService<MaintenanceOrderDto, MaintenanceOrderRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/maintenance-order`;
}
@Injectable({ providedIn: 'root' })
export class MaintenanceOrderChecklistApiService extends CrudApiService<MaintenanceOrderChecklistDto, MaintenanceOrderChecklistRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/maintenance-order/checklists`;
}
@Injectable({ providedIn: 'root' })
export class MaintenanceOrderChecklistItemApiService extends CrudApiService<MaintenanceOrderChecklistItemDto, MaintenanceOrderChecklistItemRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/maintenance-order/checklist/items`;
}
//#endregion

//#region Failure Code
@Injectable({ providedIn: 'root' })
export class FailureGroupApiService extends CrudApiService<FailureGroupDto, FailureGroupRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/failure-group`;
}

@Injectable({ providedIn: 'root' })
export class FailureCodeApiService extends CrudApiService<FailureCodeDto, FailureCodeRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/failure-code`;
}
//#endregion
