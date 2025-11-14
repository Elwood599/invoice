/**
 * Invoice Modal - Main Component
 * Refactored to use modular structure with custom hooks and components
 */

import {
	Navigator,
	Screen,
	Text,
	reactExtension,
	Stack,
	useCartSubscription,
	Banner,
	useApi,
	SectionHeader,
	ScrollView,
	Button,
	List,
	useConnectivitySubscription,
	TextField,
} from '@shopify/ui-extensions-react/point-of-sale';
import { useEffect, useState } from 'react';

// Custom Hooks
import { useAppConfig } from './hooks/useAppConfig';
import { useCustomerInvoiceData } from './hooks/useCustomerInvoiceData';

// Components
import { CustomerTypeSelector } from './components/CustomerTypeSelector';
import { IndividualForm } from './components/IndividualForm';
import { CompanyForm } from './components/CompanyForm';

const InvoiceModal = () => {
	const cart = useCartSubscription();
	const customerId = cart?.customer?.id ? String(cart.customer.id) : undefined;
	const connectivity = useConnectivitySubscription();

	const api = useApi<'pos.home.modal.render'>();
	const { getSessionToken } = api.session;

	// Session Token
	const [sessionToken, setSessionToken] = useState<string>();

	// Customer Search State
	const [searchQuery, setSearchQuery] = useState('');
	const [customerList, setCustomerList] = useState<any[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	// Refresh trigger - increment to force data reload
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	// Track previous customerId to detect changes
	const [previousCustomerId, setPreviousCustomerId] = useState<string | undefined>(customerId);

	// Get session token on mount and trigger refresh
	useEffect(() => {
		const fetchToken = async () => {
			const token = await getSessionToken();
			setSessionToken(token);
		};
		fetchToken();

		// Trigger refresh every time modal becomes visible
		setRefreshTrigger(prev => prev + 1);
	}, [getSessionToken]);

	// Fetch app configuration
	const { appUrl, error: configError } = useAppConfig(sessionToken);

	// Clean up invoice cart properties when customer is removed or cart is cleared
	useEffect(() => {
		const cleanupInvoiceProperties = async () => {
			// Check if customer was removed (was set, now undefined)
			const customerWasRemoved = previousCustomerId && !customerId;

			// Check if cart is empty (no items)
			const cartIsEmpty = !cart?.lineItems || cart.lineItems.length === 0;

			if (customerWasRemoved || (cartIsEmpty && cart?.properties?.['_invoice.requested'])) {
				console.log('[MODAL] Cleaning up invoice properties - customer removed or cart empty');
				try {
					// Remove cart properties
					const propertiesToRemove = [
						'_invoice.updated_at',
						'_invoice.requested',
						'_invoice.emitted',
						'_invoice.customer_type',
						'_invoice.codice_fiscale',
						'_invoice.pec',
						'_invoice.codice_sdi',
						'_invoice.ragione_sociale',
						'_invoice.partita_iva',
						'_invoice.sede_legale.via',
						'_invoice.sede_legale.cap',
						'_invoice.sede_legale.citta',
						'_invoice.sede_legale.provincia',
						'Fattura - Ragione Sociale',
						'Fattura - P.IVA',
						'Fattura - C.F.',
						'Fattura - Codice Fiscale',
						'Fattura - Sede',
						'Fattura - PEC',
						'Fattura - Codice SDI',
					];

					await api.cart.removeCartProperties(propertiesToRemove);
					console.log('[MODAL] Cart properties cleaned up');

					// Also reset customer's request_invoice flag if we have a customer and app URL
					if (previousCustomerId && appUrl && sessionToken) {
						console.log('[MODAL] Resetting customer request_invoice flag for customer:', previousCustomerId);
						try {
							await fetch(`${appUrl}/api/customer-invoice-emit`, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'Authorization': `Bearer ${sessionToken}`,
								},
								body: JSON.stringify({
									customerId: previousCustomerId,
									value: false,
								}),
							});
							console.log('[MODAL] Customer request_invoice flag reset successfully');
						} catch (error) {
							console.error('[MODAL] Error resetting customer request_invoice flag:', error);
						}
					}
				} catch (error) {
					console.log('[MODAL] Could not cleanup invoice properties:', error);
				}
			}

			// Update previous customerId
			setPreviousCustomerId(customerId);
		};

		cleanupInvoiceProperties();
	}, [customerId, cart?.lineItems, cart?.properties, previousCustomerId, api.cart, appUrl, sessionToken]);

	// Use customer invoice data hook
	const {
		customerType,
		setCustomerType,
		valuesToSave,
		isInvoicePossible,
		missingFields,
		requestInvoice,
		isDirty,
		fieldErrors,
		isLoadingData,
		hasLoadedOnce,
		isSaving,
		isTogglingInvoice,
		saveError,
		networkError,
		saveCustomerData,
		toggleInvoiceRequest,
		updateField,
		validateField,
	} = useCustomerInvoiceData({
		customerId,
		appUrl,
		sessionToken,
		refreshTrigger,
		cartProperties: cart?.properties,
	});

	// Customer Search Logic
	const searchCustomers = async (query: string) => {
		if (!query || query.length < 2) {
			setCustomerList([]);
			return;
		}

		setIsSearching(true);

		try {
			const graphqlQuery = `
				query SearchCustomers($query: String!) {
					customers(first: 10, query: $query) {
						edges {
							node {
								id
								firstName
								lastName
								email
								phone
							}
						}
					}
				}
			`;

			const response = await fetch('shopify:admin/api/graphql.json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({
					query: graphqlQuery,
					variables: { query },
				}),
			});

			const result = await response.json();

			if (result.data?.customers?.edges) {
				const customers = result.data.customers.edges.map((edge: any) => edge.node);
				setCustomerList(customers);
			}
		} catch (error) {
			console.error('[SEARCH] Error searching customers:', error);
		} finally {
			setIsSearching(false);
		}
	};

	const handleCustomerSelect = async (customer: any) => {
		try {
			// Extract numeric ID from GID format (gid://shopify/Customer/123 -> 123)
			const numericId = parseInt(customer.id.split('/').pop(), 10);

			// Set customer in cart with numeric ID
			await api.cart.setCustomer({ id: numericId });
			setSearchQuery('');
			setCustomerList([]);
		} catch (error) {
			console.error('[SEARCH] Error setting customer:', error);
		}
	};

	// Handle customer type change
	const handleCustomerTypeChange = (type: 'individual' | 'company') => {
		setCustomerType(type);
		// Mark as dirty when type changes
		updateField('customer_type', type);
	};

	// Handle save button press
	const handleSave = async () => {
		const success = await saveCustomerData();
		// Could show a toast or feedback here if needed
	};

	// Handle invoice toggle
	const handleInvoiceToggle = async () => {
		if (!isInvoicePossible) {
			// Don't allow toggle if data is incomplete
			return;
		}
		const success = await toggleInvoiceRequest(!requestInvoice);

		// Trigger tile refresh and add invoice data to cart properties
		if (success) {
			console.log('[MODAL] Invoice toggled successfully, updating cart properties');
			try {
				const newRequestState = !requestInvoice;

				if (newRequestState) {
					// Invoice enabled - add invoice data to cart properties
					const properties: Record<string, string> = {
						'_invoice.updated_at': Date.now().toString(),
						'_invoice.requested': 'true',
						'_invoice.emitted': 'false',
					};

					// Add structured data with _invoice. prefix (hidden, for programmatic access)
					properties['_invoice.customer_type'] = customerType;
					if (valuesToSave.codice_fiscale) properties['_invoice.codice_fiscale'] = valuesToSave.codice_fiscale;
					if (valuesToSave.pec) properties['_invoice.pec'] = valuesToSave.pec;
					if (valuesToSave.codice_sdi) properties['_invoice.codice_sdi'] = valuesToSave.codice_sdi;

					if (customerType === 'company') {
						// Company-specific structured fields
						if (valuesToSave.ragione_sociale) properties['_invoice.ragione_sociale'] = valuesToSave.ragione_sociale;
						if (valuesToSave.partita_iva) properties['_invoice.partita_iva'] = valuesToSave.partita_iva;
						if (valuesToSave.sede_legale_via) properties['_invoice.sede_legale.via'] = valuesToSave.sede_legale_via;
						if (valuesToSave.sede_legale_cap) properties['_invoice.sede_legale.cap'] = valuesToSave.sede_legale_cap;
						if (valuesToSave.sede_legale_citta) properties['_invoice.sede_legale.citta'] = valuesToSave.sede_legale_citta;
						if (valuesToSave.sede_legale_provincia) properties['_invoice.sede_legale.provincia'] = valuesToSave.sede_legale_provincia;
					}

					// Add human-readable labels (for display in POS cart)
					if (customerType === 'company') {
						if (valuesToSave.ragione_sociale) properties['Fattura - Ragione Sociale'] = valuesToSave.ragione_sociale;
						if (valuesToSave.partita_iva) properties['Fattura - P.IVA'] = valuesToSave.partita_iva;
						if (valuesToSave.codice_fiscale) properties['Fattura - C.F.'] = valuesToSave.codice_fiscale;
						if (valuesToSave.sede_legale_via) {
							properties['Fattura - Sede'] = `${valuesToSave.sede_legale_via}, ${valuesToSave.sede_legale_cap} ${valuesToSave.sede_legale_citta} (${valuesToSave.sede_legale_provincia})`;
						}
					} else {
						if (valuesToSave.codice_fiscale) properties['Fattura - Codice Fiscale'] = valuesToSave.codice_fiscale;
					}

					// Optional fields labels (for both types)
					if (valuesToSave.pec) properties['Fattura - PEC'] = valuesToSave.pec;
					if (valuesToSave.codice_sdi) properties['Fattura - Codice SDI'] = valuesToSave.codice_sdi;

					await api.cart.addCartProperties(properties);
					console.log('[MODAL] Invoice data added to cart properties');
				} else {
					// Invoice disabled - remove invoice properties
					const propertiesToRemove = [
						'_invoice.requested',
						'_invoice.emitted',
						// Structured properties (with underscore prefix)
						'_invoice.customer_type',
						'_invoice.codice_fiscale',
						'_invoice.pec',
						'_invoice.codice_sdi',
						'_invoice.ragione_sociale',
						'_invoice.partita_iva',
						'_invoice.sede_legale.via',
						'_invoice.sede_legale.cap',
						'_invoice.sede_legale.citta',
						'_invoice.sede_legale.provincia',
						// Human-readable labels (visible in cart)
						'Fattura - Ragione Sociale',
						'Fattura - P.IVA',
						'Fattura - C.F.',
						'Fattura - Codice Fiscale',
						'Fattura - Sede',
						'Fattura - PEC',
						'Fattura - Codice SDI',
					];

					await api.cart.removeCartProperties(propertiesToRemove);
					await api.cart.addCartProperties({
						'_invoice_updated_at': Date.now().toString()
					});
					console.log('[MODAL] Invoice data removed from cart properties');
				}

				console.log('[MODAL] Cart properties updated to trigger Tile refresh');
			} catch (error) {
				console.log('[MODAL] Could not update cart properties:', error);
			}
		}
	};

	// Determine if we're in data loading state
	// Show loading if: we have a customer AND (we haven't loaded data yet OR we're currently loading)
	const isDataLoading = customerId && (!hasLoadedOnce || isLoadingData);

	return (
		<Navigator>
			<Screen name="InvoiceRequest" title="Richiedi Fattura">
				<ScrollView>
					<Stack direction="vertical" gap="400" padding="400">
						{/* Network Status */}
						{connectivity.internetConnected === 'Disconnected' && (
							<Banner
								title="⚠️ Nessuna connessione internet"
								variant="error"
								visible
							/>
						)}

						{/* Global Loading State */}
						{isDataLoading ? (
							<Stack direction="vertical" gap="400" padding="400">
								<Text>⏳ Caricamento dati fattura...</Text>
								<Text>Attendere prego</Text>
							</Stack>
						) : (
							<>
								{/* Config Error */}
								{configError && (
									<Banner title={configError} variant="error" visible />
								)}

								{/* Network Error */}
								{networkError && (
									<Banner title={networkError} variant="error" visible />
								)}

								{/* Save Error */}
								{saveError && (
									<Banner title={saveError} variant="error" visible />
								)}

								{/* Warning for incomplete data */}
								{missingFields.length > 0 && !saveError && (
									<Banner
										title={`⚠️ Campi mancanti: ${missingFields.join(', ')}`}
										variant="alert"
										visible
									/>
								)}

								{/* Customer Search (only if no customer in cart) */}
								{!customerId && (
							<>
								<SectionHeader title="Seleziona Cliente" />
								<Stack direction="vertical" gap="200" padding="200">
									<Text>Cerca un cliente esistente per nome, email o telefono</Text>
									<TextField
										label="Cerca cliente"
										value={searchQuery}
										onInput={(val) => {
											setSearchQuery(val);
											searchCustomers(val);
										}}
										placeholder="Nome, email o telefono..."
									/>

									{isSearching && <Text>Ricerca in corso...</Text>}

									{customerList.length > 0 && (
										<List
											data={customerList.map((customer) => ({
												id: customer.id,
												leftSide: {
													label: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
													subtitle: customer.email ? [customer.email] : undefined,
												},
												onPress: () => handleCustomerSelect(customer),
											}))}
										/>
									)}
								</Stack>
							</>
						)}

						{/* Customer Summary (if customer is selected) */}
						{customerId && (
							<>
								<SectionHeader title="Riepilogo cliente" />
								<Stack direction="vertical" gap="200" padding="200">
									<Stack direction="horizontal" gap="200">
										<Text>Cliente ID:</Text>
										<Text>{customerId}</Text>
									</Stack>
									<Stack direction="horizontal" gap="200">
										<Text>Stato fattura:</Text>
										<Text>{requestInvoice ? '✓ Richiesta' : 'Non richiesta'}</Text>
									</Stack>
								</Stack>

								{/* Data Entry Form */}
								<SectionHeader
									title="Dati fiscali"
									action={{
										label: isDirty ? 'Salva modifiche' : '✓ Salvato',
										onPress: isDirty ? handleSave : undefined,
									}}
								/>

								{isLoadingData ? (
									<Text>Caricamento dati...</Text>
								) : (
									<>
										{/* Customer Type Selector */}
										<CustomerTypeSelector
											customerType={customerType}
											onTypeChange={handleCustomerTypeChange}
										/>

										{/* Conditional Form Rendering */}
										{customerType === 'individual' && (
											<IndividualForm
												values={valuesToSave}
												errors={fieldErrors}
												onFieldChange={updateField}
												onFieldBlur={validateField}
											/>
										)}

										{customerType === 'company' && (
											<CompanyForm
												values={valuesToSave}
												errors={fieldErrors}
												onFieldChange={updateField}
												onFieldBlur={validateField}
											/>
										)}

										{/* Save Button (only if dirty) */}
										{isDirty && (
											<Button
												title={isSaving ? 'Salvataggio...' : 'Salva dati'}
												type="primary"
												isDisabled={isSaving || Object.keys(fieldErrors).length > 0}
												onPress={handleSave}
											/>
										)}
									</>
								)}

								{/* Invoice Request Toggle */}
								<SectionHeader title="Richiesta fattura" />

								{requestInvoice && (
									<Banner
										title="✓ La fattura verrà emessa automaticamente per questo ordine"
										variant="confirmation"
										visible
									/>
								)}

								<List
									data={[
										{
											id: 'invoice-request',
											leftSide: {
												label: requestInvoice ? 'Disabilita richiesta fattura' : 'Abilita richiesta fattura',
												subtitle: [requestInvoice
													? 'Toccando disabiliterai la richiesta di fattura per questo ordine'
													: 'Toccando richiederai la fattura per questo ordine'],
											},
											rightSide: requestInvoice ? {
												label: '✓',
											} : undefined,
											onPress: (isTogglingInvoice || !isInvoicePossible) ? undefined : handleInvoiceToggle,
										},
									]}
								/>

								{!isInvoicePossible && (
									<Banner
										title="Completa tutti i campi obbligatori per abilitare la richiesta fattura"
										variant="information"
										visible
									/>
								)}
							</>
						)}

						{/* No Customer Selected */}
						{!customerId && customerList.length === 0 && !searchQuery && (
							<Stack direction="vertical" gap="200" padding="400">
								<Text>👤 Nessun cliente nel carrello</Text>
								<Text>Cerca e seleziona un cliente per richiedere la fattura</Text>
							</Stack>
						)}
					</>
				)}
					</Stack>
				</ScrollView>
			</Screen>
		</Navigator>
	);
};

export default reactExtension('pos.home.modal.render', () => <InvoiceModal />);
