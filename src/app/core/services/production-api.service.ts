import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SalesOrderDto, SalesOrderRequest, SalesOrderItemDto, SalesOrderItemRequest, SalesOrderPaymentScheduleDto, SalesOrderPaymentScheduleRequest, ProductionRequestDto, ProductionRequestItemDto, ProductionRequestItemRequest, ProductionRequestRequest } from '../../domain/models/production.model';
import { CrudApiService } from './crud-api.service';

//#region Sale order
@Injectable({ providedIn: 'root' })
export class SaleOrderApiService extends CrudApiService<SalesOrderDto, SalesOrderRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/production/sales-order`;
}

@Injectable({ providedIn: 'root' })
export class SaleOrderItemApiService extends CrudApiService<SalesOrderItemDto, SalesOrderItemRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/production/sales-order/items`;
}

@Injectable({ providedIn: 'root' })
export class SaleOrderPaymentScheduleApiService extends CrudApiService<SalesOrderPaymentScheduleDto, SalesOrderPaymentScheduleRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/production/sales-order/payment-schedules`;
}
//#endregion

//#region Production request
@Injectable({ providedIn: 'root' })
export class ProductionRequestApiService extends CrudApiService<ProductionRequestDto, ProductionRequestRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/production/request`;
}

@Injectable({ providedIn: 'root' })
export class ProductionRequestItemApiService extends CrudApiService<ProductionRequestItemDto, ProductionRequestItemRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/production/request/items`;
}
//#endregion
