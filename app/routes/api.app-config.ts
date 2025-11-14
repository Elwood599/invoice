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
  try {
    // Authenticate the request to ensure it comes from an authorized source
    await authenticate.admin(request);

    // Get the current app URL from environment
    const appUrl = process.env.SHOPIFY_APP_URL || '';

    if (!appUrl) {
      return new Response(JSON.stringify({
        error: 'App URL not configured',
        appUrl: null
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      appUrl: appUrl,
      environment: process.env.NODE_ENV || 'development'
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err) {
    console.error("[APP-CONFIG ERROR]", err);
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to retrieve app configuration"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
