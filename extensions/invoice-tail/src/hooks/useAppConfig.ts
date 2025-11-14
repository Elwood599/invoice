/**
 * Custom hook to fetch app configuration (app URL from shop metafield)
 */

import { useState, useEffect } from 'react';

export const useAppConfig = (sessionToken: string | undefined) => {
	const [appUrl, setAppUrl] = useState<string>('');
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchAppConfig = async () => {
			if (!sessionToken) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				setError(null);

				const query = `
					query GetShopMetafield {
						shop {
							metafield(namespace: "app_config", key: "app_url") {
								value
							}
						}
					}
				`;

				const response = await fetch('shopify:admin/api/graphql.json', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${sessionToken}`,
					},
					body: JSON.stringify({ query }),
				});

				const result = await response.json();

				if (result.data?.shop?.metafield?.value) {
					const url = result.data.shop.metafield.value;
					setAppUrl(url);
					console.log('[APP-CONFIG] App URL loaded:', url);
				} else {
					setError('App URL not configured in shop metafields');
					console.error('[APP-CONFIG] App URL not found in metafield');
				}
			} catch (err) {
				console.error('[APP-CONFIG] Error fetching app config:', err);
				setError('Failed to load app configuration');
			} finally {
				setIsLoading(false);
			}
		};

		fetchAppConfig();
	}, [sessionToken]);

	return { appUrl, isLoading, error };
};
