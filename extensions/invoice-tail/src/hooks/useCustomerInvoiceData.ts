/**
 * Custom hook to manage customer invoice data (fetch, save, toggle)
 */

import { useState, useEffect, useCallback } from 'react';
import type {
	CustomerType,
	InvoiceFormValues,
	FieldErrors,
	CustomerInvoiceResponse,
	SaveInvoiceResponse,
} from '../types/invoice';
import {
	validatePartitaIVA,
	validateCodiceFiscale,
	validatePEC,
	validateRagioneSociale,
	validateSedeLegaleVia,
	validateSedeLegaleCAP,
	validateSedeLegaleCitta,
	validateSedeLegaleProvincia,
	validateCodiceSDI,
} from '../utils/validators';

interface UseCustomerInvoiceDataProps {
	customerId: string | undefined;
	appUrl: string;
	sessionToken: string | undefined;
	refreshTrigger?: number;
	cartProperties?: Record<string, string>;
}

export const useCustomerInvoiceData = ({
	customerId,
	appUrl,
	sessionToken,
	refreshTrigger,
	cartProperties,
}: UseCustomerInvoiceDataProps) => {
	// State
	const [customerType, setCustomerType] = useState<CustomerType>('company');
	const [valuesToSave, setValuesToSave] = useState<InvoiceFormValues>({});
	const [isInvoicePossible, setIsInvoicePossible] = useState(false);
	const [missingFields, setMissingFields] = useState<string[]>([]);
	const [requestInvoice, setRequestInvoice] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

	// Loading states
	const [isLoadingData, setIsLoadingData] = useState(false);
	const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isTogglingInvoice, setIsTogglingInvoice] = useState(false);

	// Error states
	const [saveError, setSaveError] = useState<string | null>(null);
	const [networkError, setNetworkError] = useState<string | null>(null);

	// Fetch customer invoice data
	const fetchCustomerData = useCallback(async () => {
		if (!customerId || !appUrl || !sessionToken) return;

		setIsLoadingData(true);
		setNetworkError(null);

		try {
			const response = await fetch(`${appUrl}/api/customer-invoice-data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({ customerId }),
			});

			const data: CustomerInvoiceResponse = await response.json();

			console.log('[INVOICE-DATA] Received data:', JSON.stringify(data, null, 2));

			if (data.success && data.invoice) {
				setIsInvoicePossible(data.invoice.isInvoicePossible);
				setMissingFields(data.invoice.missingFields);
				setValuesToSave(data.invoice.values);

				// IMPORTANT: Give priority to cart properties over customer metafields
				// If cart properties exist, use them. Otherwise default to false.
				// This prevents stale customer metafield from showing when cart is cleared.
				const hasCartInvoiceRequest = cartProperties?.['_invoice.requested'] !== undefined;
				const invoiceRequestedFromCart = cartProperties?.['_invoice.requested'] === 'true';
				const invoiceRequestedFromCustomer = data.invoice.emitInvoice || false;

				// If cart properties exist, use them. If not, assume clean cart = false
				// We ignore customer metafield unless cart explicitly requests invoice
				const finalInvoiceRequested = hasCartInvoiceRequest
					? invoiceRequestedFromCart
					: false; // Clean cart always starts with false

				setRequestInvoice(finalInvoiceRequested);

				console.log('[INVOICE-DATA] Cart has invoice request:', hasCartInvoiceRequest);
				console.log('[INVOICE-DATA] Invoice requested from cart:', invoiceRequestedFromCart);
				console.log('[INVOICE-DATA] Invoice requested from customer:', invoiceRequestedFromCustomer);
				console.log('[INVOICE-DATA] Final requestInvoice (using cart priority):', finalInvoiceRequested);

				// Set customer type from loaded data
				if (data.invoice.values.customer_type) {
					setCustomerType(data.invoice.values.customer_type);
				} else {
					// Default based on existing fields
					const hasCompanyFields = data.invoice.values.partita_iva || data.invoice.values.ragione_sociale;
					setCustomerType(hasCompanyFields ? 'company' : 'individual');
				}

				setIsDirty(false);
			} else {
				setIsInvoicePossible(false);
				setMissingFields([]);
				setValuesToSave({});
				setRequestInvoice(false);
				setCustomerType('company');
			}

			// Mark as loaded successfully
			setHasLoadedOnce(true);
		} catch (error) {
			console.error('[INVOICE-DATA] Error fetching customer metafields:', error);
			setNetworkError('Impossibile caricare i dati del cliente');
			// Still mark as loaded even on error to prevent infinite loading
			setHasLoadedOnce(true);
		} finally {
			setIsLoadingData(false);
		}
	}, [customerId, appUrl, sessionToken]);

	// Reset hasLoadedOnce when customer changes
	useEffect(() => {
		setHasLoadedOnce(false);
	}, [customerId]);

	// Load data on mount and when customer changes or refresh is triggered
	useEffect(() => {
		fetchCustomerData();
	}, [fetchCustomerData, refreshTrigger]);

	// Validate and save customer data
	const saveCustomerData = useCallback(async () => {
		if (!customerId || !appUrl || !sessionToken) return false;

		// Validate fields based on customer type
		const errors: FieldErrors = {};

		if (customerType === 'company') {
			// Company validation
			const partitaIVAError = validatePartitaIVA(valuesToSave.partita_iva || '');
			const codiceFiscaleError = validateCodiceFiscale(valuesToSave.codice_fiscale || '');
			const ragioneSocialeError = validateRagioneSociale(valuesToSave.ragione_sociale || '');
			const sedeLegaleViaError = validateSedeLegaleVia(valuesToSave.sede_legale_via || '');
			const sedeLegaleCAPError = validateSedeLegaleCAP(valuesToSave.sede_legale_cap || '');
			const sedeLegaleCittaError = validateSedeLegaleCitta(valuesToSave.sede_legale_citta || '');
			const sedeLegaleProvinciaError = validateSedeLegaleProvincia(valuesToSave.sede_legale_provincia || '');

			if (partitaIVAError) errors.partita_iva = partitaIVAError;
			if (codiceFiscaleError) errors.codice_fiscale = codiceFiscaleError;
			if (ragioneSocialeError) errors.ragione_sociale = ragioneSocialeError;
			if (sedeLegaleViaError) errors.sede_legale_via = sedeLegaleViaError;
			if (sedeLegaleCAPError) errors.sede_legale_cap = sedeLegaleCAPError;
			if (sedeLegaleCittaError) errors.sede_legale_citta = sedeLegaleCittaError;
			if (sedeLegaleProvinciaError) errors.sede_legale_provincia = sedeLegaleProvinciaError;
		} else {
			// Individual validation - only codice fiscale is required
			const codiceFiscaleError = validateCodiceFiscale(valuesToSave.codice_fiscale || '');
			if (codiceFiscaleError) errors.codice_fiscale = codiceFiscaleError;
		}

		// Optional fields for both types
		const pecError = valuesToSave.pec ? validatePEC(valuesToSave.pec) : null;
		const codiceSDIError = valuesToSave.codice_sdi ? validateCodiceSDI(valuesToSave.codice_sdi) : null;

		if (pecError) errors.pec = pecError;
		if (codiceSDIError) errors.codice_sdi = codiceSDIError;

		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			setSaveError('Correggi gli errori prima di salvare');
			return false;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			const response = await fetch(`${appUrl}/api/customer-invoice-save`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({
					customerId,
					values: {
						...valuesToSave,
						customer_type: customerType,
					},
				}),
			});

			const result: SaveInvoiceResponse = await response.json();

			if (result.success) {
				if (result.values) setValuesToSave(result.values);
				if (result.isInvoicePossible !== undefined) setIsInvoicePossible(result.isInvoicePossible);
				if (result.missingFields) setMissingFields(result.missingFields);
				setIsDirty(false);
				setFieldErrors({});
				setSaveError(null);
				return true;
			} else {
				setSaveError('Errore nel salvataggio dei dati');
				return false;
			}
		} catch (error) {
			console.error('[INVOICE-DATA] Error saving customer data:', error);
			setSaveError('Errore di connessione. Riprova.');
			return false;
		} finally {
			setIsSaving(false);
		}
	}, [customerId, appUrl, sessionToken, customerType, valuesToSave]);

	// Toggle invoice request
	const toggleInvoiceRequest = useCallback(async (value: boolean) => {
		if (!customerId || !appUrl || !sessionToken) return false;

		console.log('[INVOICE-DATA] Toggling invoice request to:', value);

		setIsTogglingInvoice(true);

		try {
			const response = await fetch(`${appUrl}/api/customer-invoice-emit`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({
					customerId,
					value,
				}),
			});

			const result = await response.json();

			console.log('[INVOICE-DATA] Toggle result:', result);

			if (result.success) {
				setRequestInvoice(value);
				console.log('[INVOICE-DATA] Successfully set requestInvoice to:', value);
				return true;
			} else {
				console.error('[INVOICE-DATA] Toggle failed:', result);
				return false;
			}
		} catch (error) {
			console.error('[INVOICE-DATA] Error toggling invoice request:', error);
			return false;
		} finally {
			setIsTogglingInvoice(false);
		}
	}, [customerId, appUrl, sessionToken]);

	// Update field value
	const updateField = useCallback((field: keyof InvoiceFormValues, value: string) => {
		setValuesToSave(prev => ({ ...prev, [field]: value }));
		setIsDirty(true);

		// Clear error for this field
		if (fieldErrors[field]) {
			const { [field]: _, ...rest } = fieldErrors;
			setFieldErrors(rest);
		}
	}, [fieldErrors]);

	// Validate single field
	const validateField = useCallback((field: keyof InvoiceFormValues, value: string) => {
		let error: string | null = null;

		switch (field) {
			case 'partita_iva':
				error = validatePartitaIVA(value);
				break;
			case 'codice_fiscale':
				error = validateCodiceFiscale(value);
				break;
			case 'pec':
				error = validatePEC(value);
				break;
			case 'ragione_sociale':
				error = validateRagioneSociale(value);
				break;
			case 'sede_legale_via':
				error = validateSedeLegaleVia(value);
				break;
			case 'sede_legale_cap':
				error = validateSedeLegaleCAP(value);
				break;
			case 'sede_legale_citta':
				error = validateSedeLegaleCitta(value);
				break;
			case 'sede_legale_provincia':
				error = validateSedeLegaleProvincia(value);
				break;
			case 'codice_sdi':
				error = validateCodiceSDI(value);
				break;
		}

		if (error) {
			setFieldErrors(prev => ({ ...prev, [field]: error }));
		}
	}, []);

	return {
		// State
		customerType,
		setCustomerType,
		valuesToSave,
		isInvoicePossible,
		missingFields,
		requestInvoice,
		isDirty,
		fieldErrors,

		// Loading states
		isLoadingData,
		hasLoadedOnce,
		isSaving,
		isTogglingInvoice,

		// Error states
		saveError,
		networkError,

		// Actions
		fetchCustomerData,
		saveCustomerData,
		toggleInvoiceRequest,
		updateField,
		validateField,
	};
};
