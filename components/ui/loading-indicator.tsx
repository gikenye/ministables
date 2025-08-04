"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { isLowBandwidth } from "@/lib/serviceWorker";

interface LoadingIndicatorProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  text?: string;
  fullScreen?: boolean;
  delay?: number; // Delay in ms before showing the loader
}

export function LoadingIndicator({
  size = "md",
  color = "primary",
  text,
  fullScreen = false,
  delay = 100,
}: LoadingIndicatorProps) {
  const [show, setShow] = useState(delay === 0);
  const [lowBandwidth, setLowBandwidth] = useState(false);

  useEffect(() => {
    // Only show loading indicator after delay to prevent flashing
    if (delay > 0) {
      const timer = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  useEffect(() => {
    // Check if user is on low bandwidth
    setLowBandwidth(isLowBandwidth());
  }, []);

  if (!show) return null;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const colorClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
    white: "text-white",
    gray: "text-gray-400",
  };

  // Simplified loading indicator for low bandwidth
  if (lowBandwidth) {
    return (
      <div
        className={`flex flex-col items-center justify-center ${
          fullScreen ? "fixed inset-0 bg-black/10 z-50" : ""
        }`}
      >
        <div className={`text-${color} font-bold text-lg`}>Loading...</div>
        {text && <p className="text-sm text-gray-500 mt-2">{text}</p>}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center ${
        fullScreen ? "fixed inset-0 bg-black/10 backdrop-blur-sm z-50" : ""
      }`}
    >
      <Loader2
        className={`animate-spin ${sizeClasses[size]} ${
          color in colorClasses
            ? colorClasses[color as keyof typeof colorClasses]
            : color
        }`}
      />
      {text && <p className="text-sm text-gray-500 mt-2">{text}</p>}
    </div>
  );
}

// Skeleton loader for content that's loading
export function SkeletonLoader({
  className = "",
  count = 1,
}: {
  className?: string;
  count?: number;
}) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          className={`animate-pulse bg-gray-200 rounded-md ${className}`}
        />
      ))}
    </>
  );
}

// Image with lazy loading and placeholder
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [lowBandwidth] = useState(isLowBandwidth());

  // For low bandwidth connections, use a smaller image if available
  const optimizedSrc =
    lowBandwidth && src.includes(".jpg")
      ? src.replace(".jpg", "-small.jpg")
      : src;

  return (
    <div className="relative" style={{ width, height }}>
      {!loaded && !error && (
        <div
          className={`absolute inset-0 bg-gray-200 animate-pulse rounded-md ${className}`}
          style={{ width, height }}
        />
      )}
      {error && (
        <div
          className={`absolute inset-0 bg-gray-100 flex items-center justify-center rounded-md ${className}`}
          style={{ width, height }}
        >
          <span className="text-gray-400 text-sm">Image not available</span>
        </div>
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
      />
    </div>
  );
}

// Data-aware component that optimizes rendering based on connection quality
export function DataAwareRender({
  children,
  lowBandwidthFallback,
}: {
  children: React.ReactNode;
  lowBandwidthFallback: React.ReactNode;
}) {
  const [lowBandwidth, setLowBandwidth] = useState(false);

  useEffect(() => {
    setLowBandwidth(isLowBandwidth());

    // Listen for connection changes
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        const updateConnectionStatus = () => {
          setLowBandwidth(isLowBandwidth());
        };

        conn.addEventListener("change", updateConnectionStatus);
        return () => conn.removeEventListener("change", updateConnectionStatus);
      }
    }
  }, []);

  return lowBandwidth ? lowBandwidthFallback : children;
}
