import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { Table } from 'primeng/table';

bootstrapApplication(AppComponent, appConfig)
	.catch((err) => console.error(err));


const originalValueSet = Object.getOwnPropertyDescriptor(Table.prototype, 'value')?.set;
Object.defineProperty(Table.prototype, 'value', {
	set(val) {
		originalValueSet?.call(this, val);
		if (this.rowGroupMode === 'subheader' && this.groupRowsBy && val?.length) {
			const field = Array.isArray(this.groupRowsBy) ? this.groupRowsBy[0] : this.groupRowsBy;
			this.expandedRowKeys = Object.fromEntries(val.map((x: any) => [String(x[field]), true]));
		}
	}
});