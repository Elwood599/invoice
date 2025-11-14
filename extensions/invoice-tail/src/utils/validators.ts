/**
 * Validation functions for invoice form fields
 */

export const validatePartitaIVA = (value: string): string | null => {
	if (!value) return 'Campo obbligatorio';
	if (!/^\d{11}$/.test(value)) return 'Deve contenere 11 cifre';
	return null;
};

export const validateCodiceFiscale = (value: string): string | null => {
	if (!value) return 'Campo obbligatorio';
	// Accept both 16-char personal code or 11-digit company code
	if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(value) && !/^\d{11}$/.test(value)) {
		return 'Formato non valido (16 caratteri o 11 cifre)';
	}
	return null;
};

export const validatePEC = (value: string): string | null => {
	if (!value) return null; // Optional field
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
		return 'Email non valida';
	}
	return null;
};

export const validateRagioneSociale = (value: string): string | null => {
	if (!value) return 'Campo obbligatorio';
	if (value.length < 2) return 'Minimo 2 caratteri';
	return null;
};

export const validateSedeLegaleVia = (value: string): string | null => {
	if (!value) return 'Campo obbligatorio';
	if (value.length < 5) return 'Minimo 5 caratteri';
	return null;
};

export const validateSedeLegaleCAP = (value: string): string | null => {
	if (!value) return 'Campo obbligatorio';
	if (!/^\d{5}$/.test(value)) return 'Deve contenere 5 cifre';
	return null;
};

export const validateSedeLegaleCitta = (value: string): string | null => {
	if (!value) return 'Campo obbligatorio';
	if (value.length < 2) return 'Minimo 2 caratteri';
	return null;
};

export const validateSedeLegaleProvincia = (value: string): string | null => {
	if (!value) return 'Campo obbligatorio';
	if (!/^[A-Z]{2}$/i.test(value)) return 'Deve contenere 2 lettere';
	return null;
};

export const validateCodiceSDI = (value: string): string | null => {
	if (!value) return null; // Optional field
	if (!/^[A-Z0-9]{7}$/i.test(value)) return 'Deve contenere 7 caratteri alfanumerici';
	return null;
};
