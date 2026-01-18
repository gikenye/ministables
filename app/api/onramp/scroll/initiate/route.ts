import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { logger } from "@/lib/services/logger";

const KES_COLLECT = process.env.KES_COLLECT;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    logger.info("Initiating KES onramp", {
      component: "onramp.scroll.initiate",
      operation: "request",
    });

    const body = await request.json();
    const {
      shortcode,
      amount,
      mobile_network = "Safaricom",
      callback_url,
      wallet_address,
    } = body;

    if (!shortcode || !amount || !mobile_network || !callback_url || !wallet_address) {
      logger.warn("KES collection missing required fields", {
        component: "onramp.scroll.initiate",
        operation: "validation",
      });
      return NextResponse.json(
        {
          error: "Shortcode, amount, mobile_network, callback_url, and wallet_address are required",
        },
        { status: 400 }
      );
    }

    if (!KES_COLLECT) {
      throw new Error("KES_COLLECT environment variable is not set");
    }

    if (!PRETIUM_API_KEY) {
      throw new Error("PRETIUM_API_KEY environment variable is not set");
    }

    logger.info("Fiat collection config loaded", {
      component: "onramp.scroll.initiate",
      operation: "config",
      additional: {
        baseURI: KES_COLLECT || "NOT_SET",
        apiKeyPresent: !!PRETIUM_API_KEY,
        apiKeyLength: PRETIUM_API_KEY ? PRETIUM_API_KEY.length : 0,
      },
    });

    const requestBody = {
      shortcode,
      amount,
      mobile_network,
      callback_url,
      wallet_address,
    };

    logger.info("Onramp request payload", {
      component: "onramp.scroll.initiate",
      operation: "payload",
      additional: { requestBody },
    });

    const fullUrl = `${KES_COLLECT}`;
    logger.info("Making request to fiat collection API", {
      component: "onramp.scroll.initiate",
      operation: "request",
      additional: { url: fullUrl },
    });

    let response;
    try {
      response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "x-api-key": PRETIUM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        // 30 second timeout handled by Next.js
      });
    } catch (fetchError) {
      logger.error("Network/Fetch error", {
        component: "onramp.scroll.initiate",
        operation: "request.error",
        additional: {
          message:
            fetchError instanceof Error ? fetchError.message : String(fetchError),
          url: fullUrl,
          cause: fetchError instanceof Error ? fetchError.cause : undefined,
        },
      });
      throw new Error(
        `Network error: Unable to reach API at ${fullUrl}. ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      );
    }

    const responseText = await response.text();
    logger.info("Raw API response received", {
      component: "onramp.scroll.initiate",
      operation: "response",
      additional: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body:
          responseText.substring(0, 500) +
          (responseText.length > 500 ? "..." : ""),
      },
    });

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logger.error("Failed to parse API response as JSON", {
        component: "onramp.scroll.initiate",
        operation: "response.parse",
        additional: {
          responseText: responseText.substring(0, 1000),
          parseError:
            parseError instanceof Error ? parseError.message : String(parseError),
        },
      });
      throw new Error(
        `API returned non-JSON response: ${response.status} ${response.statusText}`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    logger.info("Fiat collection initiated successfully", {
      component: "onramp.scroll.initiate",
      operation: "success",
      additional: { data },
    });
    
    // Store initial transaction with wallet address
    try {
      const db = await getDatabase();
      const transactionCode = data?.data?.transaction_code;
      
      if (transactionCode) {
        await db.collection("kes_transactions").updateOne(
          { transaction_code: transactionCode },
          {
            $set: {
              transaction_code: transactionCode,
              wallet_address,
              amount,
              shortcode,
              mobile_network,
              status: "INITIATED",
              created_at: new Date(),
              updated_at: new Date()
            }
          },
          { upsert: true }
        );
        logger.info("Initial transaction stored", {
          component: "onramp.scroll.initiate",
          operation: "db.update",
          additional: { transactionCode },
        });
      }
    } catch (dbError) {
      logger.error(dbError as Error, {
        component: "onramp.scroll.initiate",
        operation: "db.error",
      });
      // Don't fail the API call if DB storage fails
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    logger.error(error, {
      component: "onramp.scroll.initiate",
      operation: "error",
    });

    return NextResponse.json(
      {
        error: error.message || "Failed to initiate onramp",
      },
      { status: 500 }
    );
  }
}
