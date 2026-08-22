import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CrudApiService } from './crud-api.service';
import { PurchaseOrderDeliveryScheduleDto, PurchaseOrderDeliveryScheduleRequest, PurchaseOrderDetailDto, PurchaseOrderDto, PurchaseOrderRequest } from '../../domain/models/purchase-order.model';
import { GoodsIssueDetailRequest } from '../../domain/models/goods-issue.model';

@Injectable({
	providedIn: 'root',
})
export class PurchaseOrderApiService extends CrudApiService<PurchaseOrderDto, PurchaseOrderRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/purchase-order/orders`;
}

@Injectable({
	providedIn: 'root',
})
export class PurchaseOrderDetailApiService extends CrudApiService<PurchaseOrderDetailDto, GoodsIssueDetailRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/purchase-order/details`;
}

@Injectable({
	providedIn: 'root',
})
export class PurchaseOrderDeliveryScheduleApiService extends CrudApiService<PurchaseOrderDeliveryScheduleDto, PurchaseOrderDeliveryScheduleRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/purchase-order/delivery-schedules`;
}