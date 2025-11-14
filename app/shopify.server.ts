import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Save the app URL to a shop metafield so POS extension can access it
      const appUrl = process.env.SHOPIFY_APP_URL || "";

      if (appUrl && admin) {
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
            console.error("[AUTH] Could not retrieve shop ID");
            return;
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

          await admin.graphql(mutation, {
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

          console.log(`[AUTH] Saved app URL to shop metafield: ${appUrl}`);
        } catch (error) {
          console.error("[AUTH] Failed to save app URL to metafield:", error);
        }
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
