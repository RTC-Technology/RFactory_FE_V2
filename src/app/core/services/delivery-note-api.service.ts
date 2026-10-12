import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CrudApiService } from './crud-api.service';
import { DeliveryNoteDto, DeliveryNoteItemDto, DeliveryNoteItemRequest, DeliveryNoteReceiverDto, DeliveryNoteReceiverRequest, DeliveryNoteRequest, DeliveryNoteSenderDto, DeliveryNoteSenderRequest, DeliveryNoteSourceDto, DeliveryNoteSourceRequest } from '../../domain/models/delivery-note.model';

@Injectable({ providedIn: 'root', })
export class DeliveryNoteApiService extends CrudApiService<DeliveryNoteDto, DeliveryNoteRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/delivery-note`;
}

@Injectable({ providedIn: 'root', })
export class DeliveryNoteItemApiService extends CrudApiService<DeliveryNoteItemDto, DeliveryNoteItemRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/delivery-note/items`;
}

@Injectable({ providedIn: 'root', })
export class DeliveryNoteSourceApiService extends CrudApiService<DeliveryNoteSourceDto, DeliveryNoteSourceRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/delivery-note/sources`;
}

@Injectable({ providedIn: 'root', })
export class DeliveryNoteSenderApiService extends CrudApiService<DeliveryNoteSenderDto, DeliveryNoteSenderRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/delivery-note/senders`;
}

@Injectable({ providedIn: 'root', })
export class DeliveryNoteReceiverApiService extends CrudApiService<DeliveryNoteReceiverDto, DeliveryNoteReceiverRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/delivery-note/receivers`;
}
