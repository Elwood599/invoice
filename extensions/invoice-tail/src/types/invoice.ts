/**
 * TypeScript type definitions for Invoice Management
 */

export type CustomerType = 'individual' | 'company';

export interface InvoiceFormValues {
	// Common fields
	codice_fiscale?: string;
	pec?: string;
	codice_sdi?: string;

	// Company-only fields
	ragione_sociale?: string;
	partita_iva?: string;
	sede_legale_via?: string;
	sede_legale_cap?: string;
	sede_legale_citta?: string;
	sede_legale_provincia?: string;

	// Type identifier
	customer_type?: CustomerType;

	// Legacy fields (if needed)
	[key: string]: string | undefined;
}

export interface FieldErrors {
	[key: string]: string;
}

export interface InvoiceData {
	isInvoicePossible: boolean;
	missingFields: string[];
	values: InvoiceFormValues;
	emitInvoice: boolean;
}

export interface CustomerInvoiceResponse {
	success: boolean;
	invoice?: InvoiceData;
}

export interface SaveInvoiceResponse {
	success: boolean;
	values?: InvoiceFormValues;
	isInvoicePossible?: boolean;
	missingFields?: string[];
}
