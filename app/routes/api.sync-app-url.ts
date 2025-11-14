import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from '../shopify.server';

/**
 * This endpoint allows manual synchronization of the app URL to the shop metafield
 * Useful when SHOPIFY_APP_URL changes without triggering OAuth flow
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);

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
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not retrieve shop ID'
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
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
      console.error("[SYNC-APP-URL] Errors:", result.data.metafieldsSet.userErrors);
      return new Response(JSON.stringify({
        success: false,
        error: result.data.metafieldsSet.userErrors
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[SYNC-APP-URL] Successfully updated shop metafield to: ${appUrl}`);

    return new Response(JSON.stringify({
      success: true,
      appUrl: appUrl,
      message: "App URL synced to shop metafield successfully"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[SYNC-APP-URL ERROR]", err);
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to sync app URL"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
