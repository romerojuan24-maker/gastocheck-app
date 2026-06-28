// SAT CFDI Validator — Integración REAL (FINKOK o SAT API)
// Reemplaza el mock anterior

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface CFDIValidationRequest {
  uuid_cfdi: string;
  rfc_emisor: string;
  rfc_receptor: string;
  monto?: number;
}

interface CFDIValidationResponse {
  valid: boolean;
  status: "valid" | "invalid" | "cancelled" | "not_found" | "error";
  message: string;
  uuid: string;
}

const FINKOK_USER = Deno.env.get("FINKOK_USER");
const FINKOK_PASS = Deno.env.get("FINKOK_PASS");

// Opción 1: FINKOK (recomendado, comercial)
async function validateWithFINKOK(uuid: string): Promise<CFDIValidationResponse> {
  if (!FINKOK_USER || !FINKOK_PASS) {
    return {
      valid: false,
      status: "error",
      message: "FINKOK credentials not configured",
      uuid,
    };
  }

  try {
    const response = await fetch("https://api.finkok.com/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${FINKOK_USER}:${FINKOK_PASS}`)}`,
      },
      body: JSON.stringify({ uuid }),
    });

    const data = await response.json();

    // FINKOK responde con: {valid: true/false, status: "vigente"/"cancelado"/"no encontrado"}
    return {
      valid: data.valid === true && data.status === "vigente",
      status: data.status === "vigente" ? "valid"
        : data.status === "cancelado" ? "cancelled"
        : "not_found",
      message: data.message || "CFDI validated",
      uuid,
    };
  } catch (error) {
    console.error("FINKOK validation error:", error);
    return {
      valid: false,
      status: "error",
      message: `FINKOK error: ${error.message}`,
      uuid,
    };
  }
}

// Opción 2: SAT Portal (gratis, lento, consulta.sat.gob.mx)
async function validateWithSAT(uuid: string): Promise<CFDIValidationResponse> {
  try {
    // SAT SOAP endpoint
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:ser="http://consulta.sat.gob.mx/webservices/services">
      <soapenv:Header/>
      <soapenv:Body>
        <ser:Consulta>
          <ser:expression>RFC=${uuid}</ser:expression>
        </ser:Consulta>
      </soapenv:Body>
    </soapenv:Envelope>`;

    const response = await fetch("https://consulta.sat.gob.mx/webservices/services/consultaCFDIService", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://consulta.sat.gob.mx/webservices/services/consultaCFDIService",
      },
      body: soapRequest,
    });

    const xmlText = await response.text();

    // Parse respuesta SAT (vigente, cancelado, no encontrado)
    const isVigente = xmlText.includes("vigente");
    const isCancelado = xmlText.includes("cancelado");
    const notFound = xmlText.includes("no encontrado");

    return {
      valid: isVigente,
      status: isVigente ? "valid" : isCancelado ? "cancelled" : "not_found",
      message: isVigente ? "CFDI vigente" : isCancelado ? "CFDI cancelado" : "CFDI no encontrado",
      uuid,
    };
  } catch (error) {
    console.error("SAT validation error:", error);
    return {
      valid: false,
      status: "error",
      message: `SAT error: ${error.message}`,
      uuid,
    };
  }
}

// Usar FINKOK si está configurado, sino SAT
async function validateCFDI(request: CFDIValidationRequest): Promise<CFDIValidationResponse> {
  const { uuid_cfdi } = request;

  if (!uuid_cfdi || uuid_cfdi.length !== 36) {
    return {
      valid: false,
      status: "error",
      message: "Invalid UUID format",
      uuid: uuid_cfdi,
    };
  }

  // Prioridad: FINKOK (rápido, confiable) → SAT (gratis, lento)
  if (FINKOK_USER && FINKOK_PASS) {
    return await validateWithFINKOK(uuid_cfdi);
  } else {
    return await validateWithSAT(uuid_cfdi);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: CFDIValidationRequest = await req.json();
    const result = await validateCFDI(body);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        valid: false,
        status: "error" as const,
        message: error.message,
        uuid: "",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
