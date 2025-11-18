import { NextRequest, NextResponse } from "next/server";

const PRETIUM_BASE_URL = process.env.PRETIUM_BASE_URI || "";
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY || "";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
   try {
     const body = await req.json();
     const { type, shortcode, mobile_network, paybill_number, account_reference, currency_code } = body;

     const url = currency_code !== "KES"
       ? `${PRETIUM_BASE_URL}/v1/validation/${currency_code}`
       : `${PRETIUM_BASE_URL}/v1/validation`;

     let requestBody: any = { type };

     if (type === "PAYBILL") {
       requestBody.paybill_number = paybill_number;
       if (account_reference) {
         requestBody.account_reference = account_reference;
       }
     } else {
       requestBody.shortcode = shortcode;
       requestBody.mobile_network = mobile_network;
     }

     const response = await fetch(url, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "x-api-key": PRETIUM_API_KEY,
       },
       body: JSON.stringify(requestBody),
     });

     const data = await response.json();
     return NextResponse.json(data, {
       headers: {
         "Access-Control-Allow-Origin": "*",
       },
     });
   } catch (error) {
     return NextResponse.json({ error: "Validation failed" }, {
       status: 500,
       headers: {
         "Access-Control-Allow-Origin": "*",
       },
     });
   }
 }
