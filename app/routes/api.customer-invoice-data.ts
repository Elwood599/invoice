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
  const payload = await request.json() as { customerId: number };
  console.log("[INVOICE-DATA-GET] Payload ricevuto:", payload);

  const { customerId } = payload;
  console.log("[INVOICE-DATA-GET] Parsed:", customerId);

  if (!customerId) {
    return new Response(JSON.stringify({ error: 'Missing customerId' }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const query = `
    query GetCustomerMetafields($id: ID!) {
      customer(id: $id) {
        metafields(namespace: "invoice", first: 15) {
          edges {
            node {
              key
              value
            }
          }
        }
      }
    }
  `; 
  console.log("[INVOICE-DATA-GET] Query:", query);

  const response = await admin.graphql(query, {variables: { id: `gid://shopify/Customer/${customerId}`}});

  const result = await response.json();
  console.log("[INVOICE-DATA-GET] Result:", result.data.customer.metafields.edges);

  const edges = result.data?.customer?.metafields?.edges ?? [];

  const metafields = edges.reduce((acc:any, edge:any) => {
    acc[edge.node.key] = edge.node.value;
    return acc;
  }, {} as Record<string, string>);

  // Parse invoice_data JSON if present to get customer_type
  let invoiceData: any = {};
  try {
    if (metafields.invoice_data) {
      invoiceData = JSON.parse(metafields.invoice_data);
    }
  } catch (e) {
    console.error("[INVOICE-DATA-GET] Error parsing invoice_data JSON:", e);
  }

  // Determine customer type from invoice_data or fallback to metafield
  const customerType = invoiceData.customer_type || metafields.customer_type || 'company';

  // Determine required fields based on customer_type
  let requiredKeys: string[] = [];

  if (customerType === 'individual') {
    // Individual (Persona Fisica) - only codice_fiscale required
    requiredKeys = ['codice_fiscale'];
  } else {
    // Company (Società) - ragione sociale, partita_iva, codice_fiscale, sede legale required
    requiredKeys = [
      'ragione_sociale',
      'partita_iva',
      'codice_fiscale',
      'sede_legale_via',
      'sede_legale_cap',
      'sede_legale_citta',
      'sede_legale_provincia'
    ];
  }

  const missingFields = requiredKeys.filter((k) => !metafields[k]);

  // Check if request_invoice is set to "true" (it's stored as string "true"/"false")
  const emitInvoice = metafields.request_invoice === "true";
  console.log("[INVOICE-DATA-GET] request_invoice value:", metafields.request_invoice, "parsed as:", emitInvoice);

  const invoice = {
    isInvoicePossible: missingFields.length === 0,
    missingFields,
    values: metafields,
    emitInvoice: emitInvoice,
  } ;

  return new Response(JSON.stringify({ success: true, invoice: invoice}), {
    status: 200,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

/*
query GetCustomerInvoice($id: ID!) {
  customer(id: $id) {
    metafields(namespace: "invoice", first: 10) {
      edges {
        node {
          key
          value
        }
      }
    }
  }
}

{ "id": "gid://shopify/Customer/23650748727641"}
*/