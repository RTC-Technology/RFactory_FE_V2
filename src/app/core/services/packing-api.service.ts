import { Injectable } from '@angular/core';
import { CrudApiService } from './crud-api.service';
import { environment } from '../../../environments/environment';
import {
	PackingCheckDto,
	PackingCheckItemDto,
	PackingCheckItemRequest,
	PackingCheckRequest,
	PackingPackageDto,
	PackingPackageItemDto,
	PackingPackageItemRequest,
	PackingPackageRequest,
	PackingScanLogDto,
	PackingScanLogRequest
} from '../../domain/models/packing.model';

@Injectable({ providedIn: 'root', })
export class PackingCheckApiService extends CrudApiService<PackingCheckDto, PackingCheckRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/packing/check`;
}

@Injectable({ providedIn: 'root', })
export class PackingCheckItemApiService extends CrudApiService<PackingCheckItemDto, PackingCheckItemRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/packing/check/items`;
}

@Injectable({ providedIn: 'root', })
export class PackingPackageApiService extends CrudApiService<PackingPackageDto, PackingPackageRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/packing/package`;
}

@Injectable({ providedIn: 'root', })
export class PackingPackageItemApiService extends CrudApiService<PackingPackageItemDto, PackingPackageItemRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/packing/package/items`;
}

@Injectable({ providedIn: 'root', })
export class PackingScanLogApiService extends CrudApiService<PackingScanLogDto, PackingScanLogRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/packing/scan-logs`;
}


