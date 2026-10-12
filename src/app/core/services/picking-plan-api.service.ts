import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CrudApiService } from './crud-api.service';
import { PickingPlanDto, PickingPlanItemDto, PickingPlanItemRequest, PickingPlanItemSourceDto, PickingPlanItemSourceRequest, PickingPlanRequest, PickingPlanSourceDto, PickingPlanSourceRequest, PickingTicketDto, PickingTicketItemDto, PickingTicketItemRequest, PickingTicketRequest } from '../../domain/models/picking-plan.model';

@Injectable({ providedIn: 'root', })
export class PickingPlanApiService extends CrudApiService<PickingPlanDto, PickingPlanRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/picking-plan`;
}

@Injectable({ providedIn: 'root', })
export class PickingPlanItemApiService extends CrudApiService<PickingPlanItemDto, PickingPlanItemRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/picking-plan/items`;
}

@Injectable({ providedIn: 'root', })
export class PickingPlanItemSourceApiService extends CrudApiService<PickingPlanItemSourceDto, PickingPlanItemSourceRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/picking-plan/item-sources`;
}

@Injectable({ providedIn: 'root', })
export class PickingPlanSourceApiService extends CrudApiService<PickingPlanSourceDto, PickingPlanSourceRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/picking-plan/sources`;
}

@Injectable({ providedIn: 'root', })
export class PickingTicketApiService extends CrudApiService<PickingTicketDto, PickingTicketRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/picking-ticket`;
}

@Injectable({ providedIn: 'root', })
export class PickingTicketItemApiService extends CrudApiService<PickingTicketItemDto, PickingTicketItemRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/picking-ticket/items`;
}
