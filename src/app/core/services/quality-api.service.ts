import { Injectable } from '@angular/core';
import { CrudApiService } from './crud-api.service';
import { InspectionExecutionDto, InspectionExecutionRequest, InspectionItemDto, InspectionItemRequest, InspectionPlanDto, InspectionPlanRequest, InspectionResultDto, InspectionResultRequest, QualitySpecificationDto, QualitySpecificationItemDto, QualitySpecificationItemRequest, QualitySpecificationProductDto, QualitySpecificationProductRequest, QualitySpecificationRequest } from '../../domain/models/quality.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QualitySpecificationApiService extends CrudApiService<QualitySpecificationDto, QualitySpecificationRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/quality/spec`;
}

@Injectable({ providedIn: 'root' })
export class QualitySpecificationItemApiService extends CrudApiService<QualitySpecificationItemDto, QualitySpecificationItemRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/quality/spec/items`;
}

@Injectable({ providedIn: 'root' })
export class QualitySpecificationProductApiService extends CrudApiService<QualitySpecificationProductDto, QualitySpecificationProductRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/quality/spec/products`;
}

@Injectable({ providedIn: 'root' })
export class InspectionPlanApiService extends CrudApiService<InspectionPlanDto, InspectionPlanRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/inspection/plans`;
}

@Injectable({ providedIn: 'root' })
export class InspectionItemApiService extends CrudApiService<InspectionItemDto, InspectionItemRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/inspection/items`;
}

@Injectable({ providedIn: 'root' })
export class InspectionExecutionApiService extends CrudApiService<InspectionExecutionDto, InspectionExecutionRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/inspection/executions`;
}

@Injectable({ providedIn: 'root' })
export class InspectionResultApiService extends CrudApiService<InspectionResultDto, InspectionResultRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/inspection/results`;
}
