import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from '../shopify.server';

/**
 * This endpoint updates a specific webhook subscription with the current app URL
 * Useful when the app URL changes and webhooks need to be updated manually
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);

    const body = await request.json();
    const { webhookId, topic } = body;

    if (!webhookId || !topic) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing webhookId or topic'
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const appUrl = process.env.SHOPIFY_APP_URL || "";

    if (!appUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: 'App URL not configured in environment'
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Determine the callback URL based on the topic
    let callbackPath = '';
    switch (topic) {
      case 'ORDERS_CREATE':
        callbackPath = '/webhooks/app/orders_create';
        break;
      case 'APP_UNINSTALLED':
        callbackPath = '/webhooks/app/uninstalled';
        break;
      case 'APP_SUBSCRIPTIONS_UPDATE':
        callbackPath = '/webhooks/app/scopes_update';
        break;
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unsupported webhook topic: ${topic}`
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    const callbackUrl = `${appUrl}${callbackPath}`;

    // Update the webhook subscription
    const mutation = `
      mutation webhookSubscriptionUpdate($id: ID!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhookSubscription) {
          userErrors {
            field
            message
          }
          webhookSubscription {
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
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        id: webhookId,
        webhookSubscription: {
          callbackUrl: callbackUrl,
        },
      },
    });

    const result = await response.json();

    if (result.data?.webhookSubscriptionUpdate?.userErrors?.length > 0) {
      console.error("[UPDATE-WEBHOOK] Errors:", result.data.webhookSubscriptionUpdate.userErrors);
      return new Response(JSON.stringify({
        success: false,
        error: result.data.webhookSubscriptionUpdate.userErrors
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[UPDATE-WEBHOOK] Successfully updated webhook ${topic} to: ${callbackUrl}`);

    return new Response(JSON.stringify({
      success: true,
      webhook: result.data?.webhookSubscriptionUpdate?.webhookSubscription,
      message: `Webhook ${topic} updated successfully`
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[UPDATE-WEBHOOK ERROR]", err);
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to update webhook"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
