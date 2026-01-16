import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type Pm2Env = {
  status?: string;
  pm_uptime?: number;
  restart_time?: number;
  created_at?: number;
};

type Pm2Monit = {
  memory?: number;
  cpu?: number;
};

type Pm2Process = {
  name?: string;
  pm2_env?: Pm2Env;
  monit?: Pm2Monit;
  pid?: number;
};

/**
 * Worker Health Check API
 * GET /api/disbursement/worker/health
 *
 * Checks if the PM2 worker is running and healthy
 */
export async function GET(request: NextRequest) {
  try {
    // Check if PM2 is installed
    try {
      await execAsync("which pm2");
    } catch {
      return NextResponse.json(
        {
          status: "error",
          message: "PM2 is not installed",
          worker: "not_running",
        },
        { status: 503 }
      );
    }

    // Check worker status
    try {
      const { stdout } = await execAsync("pm2 jlist");
      const processes = JSON.parse(stdout) as Pm2Process[];

      const worker = processes.find(
        (process) => process.name === "disbursement-worker"
      );

      if (!worker || !worker.pm2_env || !worker.monit) {
        return NextResponse.json(
          {
            status: "error",
            message: "Worker is not running",
            worker: "not_found",
            hint: "Start the worker with: pm2 start ecosystem.config.json",
          },
          { status: 503 }
        );
      }

      const status = worker.pm2_env.status || "unknown";
      const uptime = worker.pm2_env.pm_uptime || 0;
      const now = Date.now();
      const uptimeMs = uptime ? now - uptime : 0;
      const restarts = worker.pm2_env.restart_time || 0;
      const memory = Math.round((worker.monit.memory || 0) / 1024 / 1024);
      const cpu = worker.monit.cpu || 0;
      const createdAt = worker.pm2_env.created_at
        ? new Date(worker.pm2_env.created_at).toISOString()
        : null;

      return NextResponse.json({
        status: status === "online" ? "healthy" : "unhealthy",
        worker: {
          name: worker.name,
          status,
          uptime: uptimeMs,
          uptimeFormatted: formatUptime(uptimeMs),
          restarts,
          pid: worker.pid,
          memory: `${memory}MB`,
          cpu: `${cpu}%`,
          created: createdAt,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to get worker status",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("❌ Error checking worker health:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Control Worker (start/stop/restart)
 * POST /api/disbursement/worker/health
 * Body: { action: "start" | "stop" | "restart" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!["start", "stop", "restart"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: start, stop, or restart" },
        { status: 400 }
      );
    }

    let command: string;
    switch (action) {
      case "start":
        command = "pm2 start ecosystem.config.json";
        break;
      case "stop":
        command = "pm2 stop disbursement-worker";
        break;
      case "restart":
        command = "pm2 restart disbursement-worker";
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { stdout, stderr } = await execAsync(command);

    return NextResponse.json({
      success: true,
      action,
      output: stdout,
      error: stderr || null,
    });
  } catch (error: unknown) {
    console.error("❌ Error controlling worker:", error);
    return NextResponse.json(
      {
        error: "Failed to control worker",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
