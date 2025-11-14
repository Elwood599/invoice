--------------------------------------------
--------------------------------------------
--------------------------------------------

SEZIONE GENERALE

--------------------------------------------
--------------------------------------------
--------------------------------------------


entra nell'area partners di shipify
crea un dev store
configura una location in italia
metti i prodotti in vendita sul POS
crea un customer demo
-----
assicurati di avere node alla versione 22.14.x
installa shopify CLI 
per creare una nuova applicazione, dal terminale scrivi:

shopify app init 

scegli 
?  Get started building your app:
✔  Build a Remix app (recommended)

?  For your Remix template, which language do you want?
✔  TypeScript

?  Create this project as a new app on Shopify?
✔  Yes, create it as a new app

?  App name:
✔  invoice-mauro-mario

--- 

entra nella cartella invoice-mauro-mario e digita il seguente comando per creare una nuova estensione

shopify app generate extension

UI extensions                                                                                                    
?  Type of extension?
✔  POS smart grid

?  Name your extension:
✔  invoice-tail

?  What would you like to work in?
✔  TypeScript React

----

apri vscode nella cartella invoice-mauro-mario ed avvia 

shopify app dev 

per lavorare in locale. 
Seleziona lo store dev di riferimento...

---

nella dev console di shopify è importante prendere e salvare la 
Preview URL e GraphiQL URL.

---

premere nella console il tasto p (Preview in your browser) per aprire l'app di shopify tramite camera dello smartphone o tablet

--- 

nella sezione https://partners.shopify.com/
abilitare per la nostra app per accedere ai campi riservati di customers.

vai in "App distribution" -> "all apps" 
seleziona l'app invocice-mauro-mario
in "API access requests" trova la sezione "Protected customer data access" e richiedi l'accesso.

nella sezione "Protected customer data" seleziona la ragione per la quale vuoi avere accesso ai campi riservati dell'uutente
nella sezione "Protected customer fields (optional)" aggiungi anche la reason per i campi come nome, email ecc...
nella sezione "Provide your data protection details" metti tutti YES o NOT APPLICABLE

--- 

creare i metafields in customer accedendo a settings->metafields & object dall'admin.shopify dello store:

invoice_data
partita_iva
ragione_sociale
pec
codice_fiscale
request_invoice

aggiungere in Order i seguenti metafields

invoice_data
emit_invoice
invoice_emitted

--- 

apri l'interfaccia di GraphiQL e crea la seguente mutation (occhio all'url, devi prendere Preview URL che hai nella console)

questa mutation abilita un webhook che viene invocatop ad ogni creazione di ordine (a chiusura scontrino)

####
mutation registerWebhook {
  webhookSubscriptionCreate(
    topic: ORDERS_CREATE,
    webhookSubscription: {
      callbackUrl: "https://impact-handled-assumed-affiliates.trycloudflare.com/webhooks/app/orders_create",
      format: JSON
    }
  ) {
    webhookSubscription {
      id
    }
    userErrors {
      field
      message
    }
  }
}
###

controlla che sia stato aggiunto con la seguente query

###
query getWebhooks {
  webhookSubscriptions(first: 10) {
    edges {
      node {
        id
        topic
        endpoint {
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
    }
  }
}
###

se restarti la console, devi modificare l'url del webhook. 
per farlo usa questa mutation (recupera l'id dalla query mutation...ad esempio "id": "gid://shopify/WebhookSubscription/1393257611451" )

###
## Edit callbackUrl
mutation webhookSubscriptionUpdate($id: ID!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhookSubscription) {
    userErrors {
      field
      message
    }
    webhookSubscription {
      id
      endpoint {
        ... on WebhookHttpEndpoint {
          callbackUrl
        }
      }
    }
  }
}
-- 
{
  "id": "gid://shopify/WebhookSubscription/1923283386692",
  "webhookSubscription": {
    "callbackUrl": "https://kelkoo-alpha-bottle-shut.trycloudflare.com/webhooks/app/orders_create"
  }
}
###

eventualmente per cancellare un webhook sbagliato, unba volta fatta la query che ti da tutti i webhook installati (vedi graphiql precendete)
è quyesta

###
mutation webhookSubscriptionDelete($id: ID!) {
  webhookSubscriptionDelete(id: $id) {
    userErrors {
      field
      message
    } 
  }
}
--
{
  "id": "gid://shopify/WebhookSubscription/1923283386692"
}


---

Modifichiamo il file shipify.app.toml ed aggiungiamo il webhook nostro nella sezione webhook
  
  [[webhooks.subscriptions]]
  topics = [ "orders/create" ]
  uri = "/webhooks/app/orders_create"

ed aumentiamo gli scopes 

scopes = "read_customers,write_customers,write_products,read_orders,write_orders"

--------------------------------------------
--------------------------------------------
--------------------------------------------

SEZIONE EXTENSION

--------------------------------------------
--------------------------------------------
--------------------------------------------

Logica di integrazione api tra ext ed app
==========================================

crea i file per l'estensione Tail e Modal

usa per la chiamate api all'applicazione il dominio trycloudflare.com che hai nella console dev.
cioe se dall'extension vuoi chiamare un'api dell'app stessa, lo puoi fare usando l'url 

https://longitude-spyware-reader-presentations.trycloudflare.com/api/customer-invoice-save

e crea il file /app/route/api.customer.invoice.save.ts 




