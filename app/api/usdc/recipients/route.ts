import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

interface RecipientMapping {
  _id?: string;
  usdc_sender_address: string;
  recipient_phone: string;
  recipient_network: "SAFARICOM" | "AIRTEL" | "TELKOM";
  shortcode?: string;
  type: "MOBILE" | "BUY_GOODS" | "PAYBILL";
  account_number?: string;
  conversion_rate?: number; // USDC to KES rate override
  min_amount?: number; // Minimum USDC amount to process
  max_amount?: number; // Maximum USDC amount to process
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface OnrampMapping {
  _id?: string;
  user_address: string;
  phone_number: string;
  mobile_network: string;
  currency_code: string;
  transaction_code?: string;
  asset: string;
  chain: string;
  type: 'ONRAMP';
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// GET - Fetch recipient mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const mapping_type = searchParams.get("type"); // 'onramp' or 'offramp'

    const db = await getDatabase();

    if (mapping_type === 'onramp') {
      // Handle onramp mappings
      if (address) {
        const mapping = await db
          .collection("onramp_recipient_mappings")
          .findOne({ user_address: address.toLowerCase() });

        return NextResponse.json({
          success: true,
          mapping: mapping ? { ...mapping, _id: mapping._id.toString() } : null,
        });
      } else {
        const mappings = await db
          .collection("onramp_recipient_mappings")
          .find({})
          .sort({ created_at: -1 })
          .toArray();

        return NextResponse.json({
          success: true,
          mappings: mappings.map((mapping) => ({
            ...mapping,
            _id: mapping._id.toString(),
          })),
        });
      }
    } else {
      // Handle offramp mappings (existing logic)
      if (address) {
        // Get specific mapping
        const mapping = await db
          .collection("recipient_mappings")
          .findOne({ usdc_sender_address: address.toLowerCase() });

        return NextResponse.json({
          success: true,
          mapping: mapping ? { ...mapping, _id: mapping._id.toString() } : null,
        });
      } else {
        // Get all mappings
        const mappings = await db
          .collection("recipient_mappings")
          .find({})
          .sort({ created_at: -1 })
          .toArray();

        return NextResponse.json({
          success: true,
          mappings: mappings.map((mapping) => ({
            ...mapping,
            _id: mapping._id.toString(),
          })),
        });
      }
    }
  } catch (error) {
    console.error("Error fetching recipient mappings:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch mappings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST - Create new recipient mapping
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { mapping_type } = data;

    const db = await getDatabase();

    if (mapping_type === 'onramp') {
      // Handle onramp mapping creation
      const { 
        user_address, 
        phone_number, 
        mobile_network, 
        currency_code = 'KES',
        transaction_code,
        asset = 'USDC',
        chain = 'SCROLL'
      } = data;

      if (!user_address || !phone_number || !mobile_network) {
        return NextResponse.json({
          error: 'user_address, phone_number, and mobile_network are required'
        }, { status: 400 });
      }

      // Create onramp recipient mapping
      const onrampMapping = {
        user_address: user_address.toLowerCase(),
        phone_number,
        mobile_network,
        currency_code,
        transaction_code,
        asset,
        chain,
        type: 'ONRAMP' as const,
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Store in database (upsert based on user_address and phone_number)
      const result = await db.collection('onramp_recipient_mappings').updateOne(
        { 
          user_address: user_address.toLowerCase(),
          phone_number,
          mobile_network,
          currency_code
        },
        {
          $set: onrampMapping,
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        message: 'Onramp recipient mapping created',
        mapping: onrampMapping,
        upserted: result.upsertedCount > 0
      });

    } else {
      // Handle offramp mapping creation (existing logic)
      const mappingData: Omit<RecipientMapping, "_id" | "created_at" | "updated_at"> = data;

      // Validate required fields
      if (!mappingData.usdc_sender_address || !mappingData.recipient_phone) {
        return NextResponse.json(
          {
            error: "Missing required fields",
            message: "usdc_sender_address and recipient_phone are required",
          },
          { status: 400 }
        );
      }

      // Validate USDC address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(mappingData.usdc_sender_address)) {
        return NextResponse.json(
          {
            error: "Invalid USDC address format",
            message: "Address must be a valid Ethereum address",
          },
          { status: 400 }
        );
      }

      // Validate phone number format (basic validation)
      if (!/^254\d{9}$/.test(mappingData.recipient_phone)) {
        return NextResponse.json(
          {
            error: "Invalid phone number format",
            message: "Phone number must be in format 254XXXXXXXXX",
          },
          { status: 400 }
        );
      }

      // Check if mapping already exists
      const existing = await db
        .collection("recipient_mappings")
        .findOne({ usdc_sender_address: mappingData.usdc_sender_address.toLowerCase() });

      if (existing) {
        return NextResponse.json(
          {
            error: "Mapping already exists",
            message: "A mapping for this USDC address already exists",
          },
          { status: 409 }
        );
      }

      // Create new mapping
      const mapping = {
        usdc_sender_address: mappingData.usdc_sender_address.toLowerCase(),
        recipient_phone: mappingData.recipient_phone,
        shortcode: mappingData.shortcode || "100", // Default amount
        type: mappingData.type || "MOBILE",
        recipient_network: mappingData.recipient_network || "SAFARICOM",
        active: mappingData.active !== false, // Default to true
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await db.collection("recipient_mappings").insertOne(mapping);

      return NextResponse.json({
        success: true,
        message: "Recipient mapping created successfully",
        mapping: {
          ...mapping,
          _id: result.insertedId.toString(),
        },
      });
    }
  } catch (error) {
    console.error("Error creating recipient mapping:", error);
    return NextResponse.json(
      {
        error: "Failed to create mapping",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT - Update existing recipient mapping
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          error: "Missing ID",
          message: "Mapping ID is required for updates",
        },
        { status: 400 }
      );
    }

    const data: Partial<RecipientMapping> = await request.json();
    const { ObjectId } = await import("mongodb");

    const db = await getDatabase();

    // Update mapping
    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.created_at;

    if (updateData.usdc_sender_address) {
      updateData.usdc_sender_address =
        updateData.usdc_sender_address.toLowerCase();
    }

    const result = await db
      .collection("recipient_mappings")
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        {
          error: "Mapping not found",
          message: "No mapping found with the provided ID",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Recipient mapping updated successfully",
    });
  } catch (error) {
    console.error("Error updating recipient mapping:", error);
    return NextResponse.json(
      {
        error: "Failed to update mapping",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete recipient mapping
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          error: "Missing ID",
          message: "Mapping ID is required for deletion",
        },
        { status: 400 }
      );
    }

    const { ObjectId } = await import("mongodb");
    const db = await getDatabase();

    const result = await db.collection("recipient_mappings").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          error: "Mapping not found",
          message: "No mapping found with the provided ID",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Recipient mapping deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting recipient mapping:", error);
    return NextResponse.json(
      {
        error: "Failed to delete mapping",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
