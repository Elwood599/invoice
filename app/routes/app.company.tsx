import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Button,
  Banner,
  Text,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function CompanyData() {
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  // Form state
  const [partitaIVA, setPartitaIVA] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [rea, setRea] = useState("");
  const [capitaleSociale, setCapitaleSociale] = useState("");
  const [pec, setPec] = useState("");
  const [codiceSdi, setCodiceSdi] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Load existing data
  useEffect(() => {
    fetch("/api/company-data")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const company = data.companyData || {};
          setPartitaIVA(company.partita_iva || "");
          setCodiceFiscale(company.codice_fiscale || "");
          setRea(company.rea || "");
          setCapitaleSociale(company.capitale_sociale || "");
          setPec(company.pec || "");
          setCodiceSdi(company.codice_sdi || "");
        }
      })
      .catch(err => {
        console.error("Error loading company data:", err);
        shopify.toast.show("Errore nel caricamento dei dati", { isError: true });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Validation functions
  const validatePartitaIVA = (value: string): string | null => {
    if (!value) return null; // Optional field
    if (!/^\d{11}$/.test(value)) return "La Partita IVA deve contenere esattamente 11 cifre";
    return null;
  };

  const validateCodiceFiscale = (value: string): string | null => {
    if (!value) return null; // Optional field
    if (!/^[A-Z0-9]{16}$/i.test(value)) return "Il Codice Fiscale deve contenere esattamente 16 caratteri alfanumerici";
    return null;
  };

  const validatePEC = (value: string): string | null => {
    if (!value) return null; // Optional field
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Inserire un indirizzo PEC valido";
    return null;
  };

  const validateCodiceSdi = (value: string): string | null => {
    if (!value) return null; // Optional field
    if (!/^[A-Z0-9]{7}$/i.test(value)) return "Il Codice SDI deve contenere esattamente 7 caratteri alfanumerici";
    return null;
  };

  const handleSave = async () => {
    // Client-side validation
    const newErrors: Record<string, string> = {};

    const partitaIVAError = validatePartitaIVA(partitaIVA);
    const codiceFiscaleError = validateCodiceFiscale(codiceFiscale);
    const pecError = validatePEC(pec);
    const codiceSdiError = validateCodiceSdi(codiceSdi);

    if (partitaIVAError) newErrors.partita_iva = partitaIVAError;
    if (codiceFiscaleError) newErrors.codice_fiscale = codiceFiscaleError;
    if (pecError) newErrors.pec = pecError;
    if (codiceSdiError) newErrors.codice_sdi = codiceSdiError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      shopify.toast.show("Correggi gli errori prima di salvare", { isError: true });
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const response = await fetch("/api/company-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyData: {
            partita_iva: partitaIVA,
            codice_fiscale: codiceFiscale,
            rea,
            capitale_sociale: capitaleSociale,
            pec,
            codice_sdi: codiceSdi,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        shopify.toast.show("Dati aziendali salvati con successo");
        setIsDirty(false);
      } else {
        if (result.errors) {
          setErrors(result.errors);
          shopify.toast.show("Errori di validazione", { isError: true });
        } else {
          shopify.toast.show(result.error || "Errore nel salvataggio", { isError: true });
        }
      }
    } catch (error) {
      console.error("Error saving company data:", error);
      shopify.toast.show("Errore di connessione", { isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setIsDirty(true);
  };

  return (
    <Page>
      <TitleBar title="Dati Aziendali" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Informazioni Fiscali Azienda
                </Text>

                <Banner tone="info">
                  <p>
                    Questi dati verranno utilizzati per generare le fatture proforma e i documenti fiscali.
                    Tutti i campi sono opzionali ma consigliati per documenti completi.
                  </p>
                </Banner>

                {isLoading && (
                  <Banner tone="info">
                    <p>Caricamento dati in corso...</p>
                  </Banner>
                )}

                {!isLoading && (
                  <BlockStack gap="400">
                    <TextField
                      label="Partita IVA"
                      value={partitaIVA}
                      onChange={handleFieldChange(setPartitaIVA)}
                      placeholder="12345678901"
                      helpText="11 cifre numeriche"
                      error={errors.partita_iva}
                      autoComplete="off"
                      maxLength={11}
                    />

                    <TextField
                      label="Codice Fiscale"
                      value={codiceFiscale}
                      onChange={handleFieldChange(setCodiceFiscale)}
                      placeholder="RSSMRA80A01H501U"
                      helpText="16 caratteri alfanumerici"
                      error={errors.codice_fiscale}
                      autoComplete="off"
                      maxLength={16}
                    />

                    <TextField
                      label="Numero REA"
                      value={rea}
                      onChange={handleFieldChange(setRea)}
                      placeholder="RM-1234567"
                      helpText="Registro delle Imprese (es: RM-1234567)"
                      autoComplete="off"
                    />

                    <TextField
                      label="Capitale Sociale"
                      value={capitaleSociale}
                      onChange={handleFieldChange(setCapitaleSociale)}
                      placeholder="10000.00"
                      helpText="Importo in euro (es: 10000.00)"
                      autoComplete="off"
                      prefix="€"
                    />

                    <Divider />

                    <Text as="h3" variant="headingSm">
                      Dati Fatturazione Elettronica
                    </Text>

                    <TextField
                      label="PEC (Posta Elettronica Certificata)"
                      value={pec}
                      onChange={handleFieldChange(setPec)}
                      placeholder="azienda@pec.it"
                      helpText="Indirizzo PEC aziendale"
                      error={errors.pec}
                      type="email"
                      autoComplete="email"
                    />

                    <TextField
                      label="Codice SDI"
                      value={codiceSdi}
                      onChange={handleFieldChange(setCodiceSdi)}
                      placeholder="ABCDEFG"
                      helpText="Codice Destinatario Sistema di Interscambio (7 caratteri)"
                      error={errors.codice_sdi}
                      autoComplete="off"
                      maxLength={7}
                    />

                    <Box paddingBlockStart="400">
                      <InlineStack gap="300" align="end">
                        <Button
                          variant="primary"
                          onClick={handleSave}
                          loading={isSaving}
                          disabled={!isDirty || isLoading}
                        >
                          Salva Dati Aziendali
                        </Button>
                        {isDirty && (
                          <Text as="span" tone="subdued" variant="bodySm">
                            Modifiche non salvate
                          </Text>
                        )}
                      </InlineStack>
                    </Box>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Guida ai Campi
                </Text>

                <BlockStack gap="200">
                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Partita IVA
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Numero di identificazione fiscale dell'azienda, composto da 11 cifre.
                    </Text>
                  </Box>

                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Codice Fiscale
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Codice alfanumerico di 16 caratteri che identifica l'azienda.
                    </Text>
                  </Box>

                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      REA
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Numero di iscrizione al Registro delle Imprese presso la Camera di Commercio.
                    </Text>
                  </Box>

                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      PEC
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Indirizzo di Posta Elettronica Certificata per comunicazioni ufficiali.
                    </Text>
                  </Box>

                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Codice SDI
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Codice di 7 caratteri per la ricezione delle fatture elettroniche tramite il Sistema di Interscambio.
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Utilizzo
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  I dati inseriti verranno automaticamente inclusi nei template di fattura proforma e nei documenti fiscali generati dall'app Order Printer.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
