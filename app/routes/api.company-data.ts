import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from '../shopify.server';

/**
 * GET: Recupera i metafields aziendali dello shop
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Get shop ID and company metafields
    const query = `
      query GetShopCompanyData {
        shop {
          id
          name
          metafields(namespace: "company", first: 10) {
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

    const response = await admin.graphql(query);
    const result = await response.json();

    console.log("[COMPANY-DATA-GET] Result:", JSON.stringify(result, null, 2));

    const shop = result.data?.shop;
    const metafields = shop?.metafields?.edges?.reduce((acc: any, edge: any) => {
      acc[edge.node.key] = edge.node.value;
      return acc;
    }, {}) || {};

    return new Response(JSON.stringify({
      success: true,
      shopId: shop?.id,
      shopName: shop?.name,
      companyData: metafields
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[COMPANY-DATA-GET ERROR]", err);
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to load company data"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * POST: Salva i metafields aziendali dello shop
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const body = await request.json();
    const { companyData } = body;

    console.log("[COMPANY-DATA-SAVE] Received data:", companyData);

    // Validazione server-side
    const errors: Record<string, string> = {};

    if (companyData.partita_iva && !/^\d{11}$/.test(companyData.partita_iva)) {
      errors.partita_iva = "La Partita IVA deve contenere esattamente 11 cifre";
    }

    if (companyData.codice_fiscale && !/^[A-Z0-9]{16}$/i.test(companyData.codice_fiscale)) {
      errors.codice_fiscale = "Il Codice Fiscale deve contenere esattamente 16 caratteri alfanumerici";
    }

    if (companyData.codice_sdi && !/^[A-Z0-9]{7}$/i.test(companyData.codice_sdi)) {
      errors.codice_sdi = "Il Codice SDI deve contenere esattamente 7 caratteri alfanumerici";
    }

    if (companyData.pec && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyData.pec)) {
      errors.pec = "Inserire un indirizzo PEC valido";
    }

    if (Object.keys(errors).length > 0) {
      return new Response(JSON.stringify({
        success: false,
        errors
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get shop ID
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

    console.log("[COMPANY-DATA-SAVE] Shop GID:", shopGid);

    // Prepare metafields array
    const metafieldsToSet = [];

    if (companyData.partita_iva) {
      metafieldsToSet.push({
        ownerId: shopGid,
        namespace: "company",
        key: "partita_iva",
        type: "single_line_text_field",
        value: companyData.partita_iva
      });
    }

    if (companyData.codice_fiscale) {
      metafieldsToSet.push({
        ownerId: shopGid,
        namespace: "company",
        key: "codice_fiscale",
        type: "single_line_text_field",
        value: companyData.codice_fiscale
      });
    }

    if (companyData.rea) {
      metafieldsToSet.push({
        ownerId: shopGid,
        namespace: "company",
        key: "rea",
        type: "single_line_text_field",
        value: companyData.rea
      });
    }

    if (companyData.capitale_sociale) {
      metafieldsToSet.push({
        ownerId: shopGid,
        namespace: "company",
        key: "capitale_sociale",
        type: "single_line_text_field",
        value: companyData.capitale_sociale
      });
    }

    if (companyData.pec) {
      metafieldsToSet.push({
        ownerId: shopGid,
        namespace: "company",
        key: "pec",
        type: "single_line_text_field",
        value: companyData.pec
      });
    }

    if (companyData.codice_sdi) {
      metafieldsToSet.push({
        ownerId: shopGid,
        namespace: "company",
        key: "codice_sdi",
        type: "single_line_text_field",
        value: companyData.codice_sdi
      });
    }

    console.log("[COMPANY-DATA-SAVE] Metafields to set:", JSON.stringify(metafieldsToSet, null, 2));

    // Save metafields
    const mutation = `
      mutation SetCompanyMetafields($metafields: [MetafieldsSetInput!]!) {
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
        metafields: metafieldsToSet
      }
    });

    const result = await response.json();

    console.log("[COMPANY-DATA-SAVE] Result:", JSON.stringify(result, null, 2));

    if (result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("[COMPANY-DATA-SAVE] Errors:", result.data.metafieldsSet.userErrors);
      return new Response(JSON.stringify({
        success: false,
        error: result.data.metafieldsSet.userErrors
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("[COMPANY-DATA-SAVE] Successfully saved company data");

    return new Response(JSON.stringify({
      success: true,
      message: "Company data saved successfully",
      metafields: result.data?.metafieldsSet?.metafields
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[COMPANY-DATA-SAVE ERROR]", err);
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to save company data"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
