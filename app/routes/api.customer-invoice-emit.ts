import { authenticate } from '../shopify.server';

// 👇 GESTIONE OPTIONS (preflight CORS)
export const loader = async ({ request }: { request: Request }) => {

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
  });
};

export const action = async ({ request }: { request: Request }) => {
  const { admin } = await authenticate.admin(request);
  const { customerId, value } = await request.json();

  console.log("[INVOICE-DATA-SAVE] Payload ricevuto:", customerId, value);
  if (!customerId) {
    return new Response(JSON.stringify({ success: false, errors: 'Missing data' }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const metafieldsInput = [{
    ownerId: `gid://shopify/Customer/${customerId}`,
    namespace: "invoice",
    key: "request_invoice",
    type: "boolean",
    value: String(value),
  }];

  const mutation = `
    mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
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
  console.log("[INVOICE-DATA-SAVE] Mutazione:", mutation);
  console.log("[INVOICE-DATA-SAVE] Variables:", metafieldsInput);

  const response = await admin.graphql(mutation, {
    variables: { metafields: metafieldsInput },
  });

  const result = await response.json();
  console.log("[INVOICE-DATA-SAVE] Payload ricevuto:", result);

  console.log("[INVOICE-DATA-SAVE] errori:", result.data?.metafieldsSet?.userErrors);
  if (result.data?.metafieldsSet?.userErrors?.length > 0) {
    console.error("Metafield error:", result.data.metafieldsSet.userErrors);
    return new Response(JSON.stringify({ success: false, errors: result.data.metafieldsSet.userErrors }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    saved: result.data.metafieldsSet.metafields,
  }), {
    status: 200,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};