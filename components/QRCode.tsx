"use client";

import { useEffect, useRef } from "react";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 200, className = "" }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Simple QR code placeholder - in production, use a proper QR library
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("QR Code", size / 2, size / 2 - 10);
    ctx.fillText("Scan with", size / 2, size / 2 + 5);
    ctx.fillText("wallet app", size / 2, size / 2 + 20);
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`border rounded ${className}`}
    />
  );
}