/**
 * Company (Società) Form Component
 * Shows all fields for company customers including legal headquarters address
 */

import { TextField, SectionHeader } from '@shopify/ui-extensions-react/point-of-sale';
import type { InvoiceFormValues, FieldErrors } from '../types/invoice';

interface CompanyFormProps {
	values: InvoiceFormValues;
	errors: FieldErrors;
	onFieldChange: (field: keyof InvoiceFormValues, value: string) => void;
	onFieldBlur: (field: keyof InvoiceFormValues, value: string) => void;
}

export const CompanyForm = ({
	values,
	errors,
	onFieldChange,
	onFieldBlur,
}: CompanyFormProps) => {
	return (
		<>
			{/* Company Info */}
			<TextField
				label="Ragione Sociale"
				required
				value={values.ragione_sociale || ''}
				error={errors.ragione_sociale}
				onInput={(val) => onFieldChange('ragione_sociale', val)}
				onBlur={() => onFieldBlur('ragione_sociale', values.ragione_sociale || '')}
				placeholder="Nome Azienda S.r.l."
			/>

			<TextField
				label="Partita IVA"
				required
				value={values.partita_iva || ''}
				error={errors.partita_iva}
				onInput={(val) => onFieldChange('partita_iva', val)}
				onBlur={() => onFieldBlur('partita_iva', values.partita_iva || '')}
				placeholder="12345678901"
			/>

			<TextField
				label="Codice Fiscale"
				required
				value={values.codice_fiscale || ''}
				error={errors.codice_fiscale}
				onInput={(val) => onFieldChange('codice_fiscale', val.toUpperCase())}
				onBlur={() => onFieldBlur('codice_fiscale', values.codice_fiscale || '')}
				placeholder="RSSMRA80A01H501U o 12345678901"
			/>

			<TextField
				label="PEC (opzionale)"
				value={values.pec || ''}
				error={errors.pec}
				onInput={(val) => onFieldChange('pec', val)}
				onBlur={() => onFieldBlur('pec', values.pec || '')}
				placeholder="azienda@pec.it"
			/>

			<TextField
				label="Codice SDI (opzionale)"
				value={values.codice_sdi || ''}
				error={errors.codice_sdi}
				onInput={(val) => onFieldChange('codice_sdi', val.toUpperCase())}
				onBlur={() => onFieldBlur('codice_sdi', values.codice_sdi || '')}
				placeholder="ABCDEFG"
			/>

			{/* Legal Headquarters */}
			<SectionHeader title="Sede Legale" />

			<TextField
				label="Via e Numero Civico"
				required
				value={values.sede_legale_via || ''}
				error={errors.sede_legale_via}
				onInput={(val) => onFieldChange('sede_legale_via', val)}
				onBlur={() => onFieldBlur('sede_legale_via', values.sede_legale_via || '')}
				placeholder="Via Roma 123"
			/>

			<TextField
				label="CAP"
				required
				value={values.sede_legale_cap || ''}
				error={errors.sede_legale_cap}
				onInput={(val) => onFieldChange('sede_legale_cap', val)}
				onBlur={() => onFieldBlur('sede_legale_cap', values.sede_legale_cap || '')}
				placeholder="20100"
			/>

			<TextField
				label="Provincia"
				required
				value={values.sede_legale_provincia || ''}
				error={errors.sede_legale_provincia}
				onInput={(val) => onFieldChange('sede_legale_provincia', val.toUpperCase())}
				onBlur={() => onFieldBlur('sede_legale_provincia', values.sede_legale_provincia || '')}
				placeholder="MI"
			/>

			<TextField
				label="Città"
				required
				value={values.sede_legale_citta || ''}
				error={errors.sede_legale_citta}
				onInput={(val) => onFieldChange('sede_legale_citta', val)}
				onBlur={() => onFieldBlur('sede_legale_citta', values.sede_legale_citta || '')}
				placeholder="Milano"
			/>
		</>
	);
};
