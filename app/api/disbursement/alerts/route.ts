import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

/**
 * Get system alerts (balance warnings, errors, etc.)
 * GET /api/disbursement/alerts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const unacknowledgedOnly = searchParams.get("unacknowledged") === "true";

    const db = await getDatabase();
    const alertsCollection = db.collection("system_alerts");

    const filter = unacknowledgedOnly ? { acknowledged: false } : {};

    const alerts = await alertsCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    const stats = {
      total: await alertsCollection.countDocuments(),
      unacknowledged: await alertsCollection.countDocuments({
        acknowledged: false,
      }),
      critical: await alertsCollection.countDocuments({
        severity: "CRITICAL",
        acknowledged: false,
      }),
    };

    return NextResponse.json({
      alerts,
      stats,
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

/**
 * Acknowledge an alert
 * POST /api/disbursement/alerts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, acknowledgeAll } = body;

    const db = await getDatabase();
    const alertsCollection = db.collection("system_alerts");

    if (acknowledgeAll) {
      // Acknowledge all unacknowledged alerts
      const result = await alertsCollection.updateMany(
        { acknowledged: false },
        {
          $set: {
            acknowledged: true,
            acknowledgedAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        acknowledgedCount: result.modifiedCount,
      });
    } else if (alertId) {
      // Acknowledge specific alert
      const { ObjectId } = require("mongodb");
      const result = await alertsCollection.updateOne(
        { _id: new ObjectId(alertId) },
        {
          $set: {
            acknowledged: true,
            acknowledgedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 0) {
        return NextResponse.json({ error: "Alert not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Missing alertId or acknowledgeAll parameter" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge alert" },
      { status: 500 }
    );
  }
}
