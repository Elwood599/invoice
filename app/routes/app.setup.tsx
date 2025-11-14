import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  List,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Check if app URL metafield already exists
  const query = `
    query CheckAppUrlMetafield {
      shop {
        metafield(namespace: "app_config", key: "app_url") {
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const result = await response.json();
  const existingAppUrl = result.data?.shop?.metafield?.value || null;

  return {
    appUrl: process.env.SHOPIFY_APP_URL || '',
    existingAppUrl,
    shop: session.shop,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const appUrl = process.env.SHOPIFY_APP_URL || "";

  if (!appUrl) {
    return {
      success: false,
      error: 'SHOPIFY_APP_URL not configured in environment',
    };
  }

  try {
    // First, get the shop's GID
    const shopQuery = `
      query GetShopId {
        shop {
          id
        }
      }
    `;

    const shopResponse = await admin.graphql(shopQuery);
    const shopResult = await shopResponse.json();
    const shopGid = shopResult.data?.shop?.id;

    if (!shopGid) {
      return {
        success: false,
        error: 'Could not retrieve shop ID',
      };
    }

    const mutation = `
      mutation SaveAppUrl($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        metafields: [
          {
            ownerId: shopGid,
            namespace: "app_config",
            key: "app_url",
            type: "single_line_text_field",
            value: appUrl,
          },
        ],
      },
    });

    const result = await response.json();

    if (result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("[SETUP] Errors:", result.data.metafieldsSet.userErrors);
      return {
        success: false,
        error: result.data.metafieldsSet.userErrors,
      };
    }

    console.log(`[SETUP] Successfully saved app URL to metafield: ${appUrl}`);

    return {
      success: true,
      appUrl,
    };
  } catch (err) {
    console.error("[SETUP ERROR]", err);
    return {
      success: false,
      error: "Failed to save app URL",
    };
  }
};

export default function Setup() {
  const { appUrl, existingAppUrl, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSetupComplete = !!existingAppUrl;
  const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Setup completed successfully!");
    } else if (fetcher.data?.error) {
      shopify.toast.show("Setup failed", { isError: true });
    }
  }, [fetcher.data]);

  const handleSetup = () => {
    fetcher.submit({}, { method: "POST" });
  };

  return (
    <Page>
      <TitleBar title="App Setup" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Initial App Configuration
              </Text>

              {isSetupComplete ? (
                <Banner tone="success">
                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">
                      Setup is already complete!
                    </Text>
                    <Text as="p" variant="bodySm">
                      The app URL is saved in shop metafield and the POS extension can access it.
                    </Text>
                    <Text as="p" variant="bodySm">
                      Current app URL: <Text as="span" fontWeight="bold">{existingAppUrl}</Text>
                    </Text>
                  </BlockStack>
                </Banner>
              ) : (
                <Banner tone="warning">
                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">
                      Setup Required
                    </Text>
                    <Text as="p" variant="bodySm">
                      The app URL needs to be saved to a shop metafield so the POS extension can access it.
                    </Text>
                  </BlockStack>
                </Banner>
              )}

              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Current Configuration
                </Text>

                <List type="bullet">
                  <List.Item>
                    <Text as="span" variant="bodyMd">
                      Shop: <Text as="span" fontWeight="semibold">{shop}</Text>
                    </Text>
                  </List.Item>
                  <List.Item>
                    <Text as="span" variant="bodyMd">
                      App URL from environment: <Text as="span" fontWeight="semibold">{appUrl || 'Not set'}</Text>
                    </Text>
                  </List.Item>
                  <List.Item>
                    <Text as="span" variant="bodyMd">
                      Saved in metafield: <Text as="span" fontWeight="semibold">{existingAppUrl || 'Not yet saved'}</Text>
                    </Text>
                  </List.Item>
                </List>
              </BlockStack>

              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  What This Does
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  This setup saves your app's URL (from SHOPIFY_APP_URL environment variable) to a shop metafield.
                  The POS extension reads this metafield to know where to send API requests.
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  In development, this URL changes each time you restart the server (Cloudflare tunnel).
                  You can run this setup again anytime the URL changes.
                </Text>
              </BlockStack>

              <Button
                onClick={handleSetup}
                variant="primary"
                loading={isLoading}
                disabled={!appUrl}
              >
                {isSetupComplete ? 'Update App URL' : 'Run Setup'}
              </Button>

              {fetcher.data?.success && (
                <Banner tone="success">
                  <Text as="p">
                    App URL saved successfully: {fetcher.data?.appUrl}
                  </Text>
                </Banner>
              )}

              {fetcher.data?.error && (
                <Banner tone="critical">
                  <Text as="p">
                    Failed to save app URL: {JSON.stringify(fetcher.data.error)}
                  </Text>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
