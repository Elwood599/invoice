import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Banner,
  List,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

type WebhookSubscription = {
  id: string;
  topic: string;
  callbackUrl: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Query current webhook subscriptions
  const response = await admin.graphql(`
    query getWebhooks {
      webhookSubscriptions(first: 50) {
        edges {
          node {
            id
            topic
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }
  `);

  const result = await response.json();
  const webhooks = result.data?.webhookSubscriptions?.edges.map((edge: any) => ({
    id: edge.node.id,
    topic: edge.node.topic,
    callbackUrl: edge.node.endpoint?.callbackUrl || 'N/A',
  })) || [];

  return {
    appUrl: process.env.SHOPIFY_APP_URL || 'Not configured',
    environment: process.env.NODE_ENV || 'development',
    webhooks,
  };
};

export default function Settings() {
  const { appUrl, environment, webhooks } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);
  const [updatingWebhook, setUpdatingWebhook] = useState<string | null>(null);
  const syncFetcher = useFetcher();
  const webhookFetcher = useFetcher();
  const shopify = useAppBridge();

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncAppUrl = () => {
    syncFetcher.submit({}, { method: "POST", action: "/api/sync-app-url" });
  };

  const handleUpdateWebhook = (webhookId: string, topic: string) => {
    setUpdatingWebhook(webhookId);
    webhookFetcher.submit(
      JSON.stringify({ webhookId, topic }),
      {
        method: "POST",
        action: "/api/update-webhook",
        encType: "application/json",
      }
    );
  };

  useEffect(() => {
    if (syncFetcher.data?.success) {
      shopify.toast.show("App URL synced successfully");
    } else if (syncFetcher.data?.error) {
      shopify.toast.show("Failed to sync app URL", { isError: true });
    }
  }, [syncFetcher.data]);

  useEffect(() => {
    if (webhookFetcher.data?.success) {
      shopify.toast.show("Webhook updated successfully");
      setUpdatingWebhook(null);
      // Reload the page to refresh webhook list
      window.location.reload();
    } else if (webhookFetcher.data?.error) {
      shopify.toast.show("Failed to update webhook", { isError: true });
      setUpdatingWebhook(null);
    }
  }, [webhookFetcher.data]);

  const isDevelopment = environment === 'development';
  const isSyncing = syncFetcher.state === "submitting" || syncFetcher.state === "loading";

  return (
    <Page>
      <TitleBar title="App Settings" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  App Configuration
                </Text>

                {isDevelopment && (
                  <Banner tone="info">
                    <p>
                      Running in <strong>development</strong> mode. The app URL will change
                      each time you restart the dev server with Cloudflare tunnel.
                    </p>
                  </Banner>
                )}

                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Current App URL:
                    </Text>
                    <Badge tone={isDevelopment ? "info" : "success"}>
                      {isDevelopment ? "Development" : "Production"}
                    </Badge>
                  </InlineStack>

                  <Box
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <InlineStack align="space-between" blockAlign="center" gap="200">
                      <Text as="code" variant="bodyMd" breakWord>
                        {appUrl}
                      </Text>
                      <Button
                        onClick={handleCopyUrl}
                        variant="plain"
                      >
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </InlineStack>
                  </Box>

                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      This URL is used by the POS extension to communicate with the backend.
                      It is stored in shop metafield and read via GraphQL query.
                    </Text>
                    <Button
                      onClick={handleSyncAppUrl}
                      loading={isSyncing}
                      size="slim"
                    >
                      Sync App URL to Shop Metafield
                    </Button>
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Webhook Subscriptions
                  </Text>
                  <InlineStack gap="200">
                    <Badge tone="success">{webhooks.length} Active</Badge>
                  </InlineStack>
                </InlineStack>

                {webhooks.some((w: WebhookSubscription) => w.callbackUrl && !w.callbackUrl.includes(appUrl)) && (
                  <Banner tone="warning">
                    <BlockStack gap="200">
                      <Text as="p" fontWeight="semibold">
                        Some webhooks are using outdated URLs
                      </Text>
                      <Text as="p" variant="bodySm">
                        The app URL has changed. Click "Update to Current URL" on each webhook to update them.
                      </Text>
                    </BlockStack>
                  </Banner>
                )}

                <Divider />

                {webhooks.length === 0 ? (
                  <Banner tone="warning">
                    <p>No webhook subscriptions found. Check your shopify.app.toml configuration.</p>
                  </Banner>
                ) : (
                  <BlockStack gap="300">
                    {webhooks.map((webhook: WebhookSubscription) => {
                      const isOldUrl = webhook.callbackUrl && !webhook.callbackUrl.includes(appUrl);
                      const isUpdating = updatingWebhook === webhook.id;

                      return (
                        <Box
                          key={webhook.id}
                          padding="300"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {webhook.topic}
                              </Text>
                              <InlineStack gap="200">
                                {isOldUrl && (
                                  <Badge tone="warning">Outdated URL</Badge>
                                )}
                                <Badge tone="success">Active</Badge>
                              </InlineStack>
                            </InlineStack>
                            <Text as="span" variant="bodySm" breakWord tone="subdued">
                              {webhook.callbackUrl}
                            </Text>
                            {isOldUrl && (
                              <Button
                                onClick={() => handleUpdateWebhook(webhook.id, webhook.topic)}
                                size="slim"
                                loading={isUpdating}
                              >
                                Update to Current URL
                              </Button>
                            )}
                          </BlockStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                )}

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    How to update webhooks
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Webhook subscriptions are automatically managed by Shopify CLI based on
                    your <code>shopify.app.toml</code> configuration.
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      During development: Webhooks update automatically when you restart <code>npm run dev</code>
                    </List.Item>
                    <List.Item>
                      For production: Run <code>npm run deploy</code> to sync webhook URLs
                    </List.Item>
                  </List>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>

                <BlockStack gap="200">
                  <Button
                    url="/app"
                    fullWidth
                  >
                    Back to Home
                  </Button>

                  {isDevelopment && (
                    <Banner tone="info">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          Testing webhooks
                        </Text>
                        <Text as="p" variant="bodySm">
                          Use Shopify CLI to trigger webhooks:
                        </Text>
                        <Box
                          padding="200"
                          background="bg-surface-active"
                          borderRadius="100"
                        >
                          <Text as="code" variant="bodySm">
                            shopify webhook trigger --topic=orders/create
                          </Text>
                        </Box>
                      </BlockStack>
                    </Banner>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
