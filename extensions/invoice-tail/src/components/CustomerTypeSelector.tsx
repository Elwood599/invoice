/**
 * Customer Type Selector Component
 * Allows user to choose between Individual (Persona Fisica) or Company (Società)
 */

import { Text, Stack, Button } from '@shopify/ui-extensions-react/point-of-sale';
import type { CustomerType } from '../types/invoice';

interface CustomerTypeSelectorProps {
	customerType: CustomerType;
	onTypeChange: (type: CustomerType) => void;
}

export const CustomerTypeSelector = ({
	customerType,
	onTypeChange,
}: CustomerTypeSelectorProps) => {
	return (
		<>
			<Text>Tipo di cliente:</Text>
			<Stack direction="horizontal" gap="200" padding="200">
				<Button
					title="🧑 Persona Fisica"
					type={customerType === 'individual' ? 'primary' : 'plain'}
					onPress={() => onTypeChange('individual')}
				/>
				<Button
					title="🏢 Società"
					type={customerType === 'company' ? 'primary' : 'plain'}
					onPress={() => onTypeChange('company')}
				/>
			</Stack>
		</>
	);
};
