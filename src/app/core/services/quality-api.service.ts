import { Injectable } from '@angular/core';
import { CrudApiService } from './crud-api.service';
import { QualitySpecificationDto, QualitySpecificationItemDto, QualitySpecificationItemRequest, QualitySpecificationProductDto, QualitySpecificationProductRequest, QualitySpecificationRequest } from '../../domain/models/quality.model';
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
