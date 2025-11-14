/**
 * Individual (Persona Fisica) Form Component
 * Shows fields for individual customers: Codice Fiscale, PEC, Codice SDI
 */

import { TextField } from '@shopify/ui-extensions-react/point-of-sale';
import type { InvoiceFormValues, FieldErrors } from '../types/invoice';

interface IndividualFormProps {
	values: InvoiceFormValues;
	errors: FieldErrors;
	onFieldChange: (field: keyof InvoiceFormValues, value: string) => void;
	onFieldBlur: (field: keyof InvoiceFormValues, value: string) => void;
}

export const IndividualForm = ({
	values,
	errors,
	onFieldChange,
	onFieldBlur,
}: IndividualFormProps) => {
	return (
		<>
			<TextField
				label="Codice Fiscale"
				required
				value={values.codice_fiscale || ''}
				error={errors.codice_fiscale}
				onInput={(val) => onFieldChange('codice_fiscale', val.toUpperCase())}
				onBlur={() => onFieldBlur('codice_fiscale', values.codice_fiscale || '')}
				placeholder="RSSMRA80A01H501U"
			/>

			<TextField
				label="PEC (opzionale)"
				value={values.pec || ''}
				error={errors.pec}
				onInput={(val) => onFieldChange('pec', val)}
				onBlur={() => onFieldBlur('pec', values.pec || '')}
				placeholder="mario.rossi@pec.it"
			/>

			<TextField
				label="Codice SDI (opzionale)"
				value={values.codice_sdi || ''}
				error={errors.codice_sdi}
				onInput={(val) => onFieldChange('codice_sdi', val.toUpperCase())}
				onBlur={() => onFieldBlur('codice_sdi', values.codice_sdi || '')}
				placeholder="ABCDEFG"
			/>
		</>
	);
};
