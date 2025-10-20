"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Shield, Globe, Coins, Users } from "lucide-react";

const stats = [
  {
    icon: Coins,
    label: "Supported Assets",
    value: "7+",
    description: "USDC, cUSD, USDT, cKES, cNGN and more",
  },
  {
    icon: Shield,
    label: "Compliance Ready",
    value: "zkSelf",
    description: "Privacy-preserving KYC/AML verification",
  },
  {
    icon: Globe,
    label: "Network",
    value: "Celo",
    description: "Fast, low-cost, carbon-negative blockchain",
  },
  {
    icon: Users,
    label: "Access",
    value: "Global",
    description: "Available worldwide with regulatory compliance",
  },
];

export function AppInfo() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Built for Everyone
        </h3>
        <p className="text-muted-foreground text-sm">
          Minilend combines the power of DeFi with regulatory compliance to
          provide accessible financial services
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card
              key={index}
              className="bg-card/40 border border-border text-center"
            >
              <CardContent className="p-4">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <IconComponent className="w-4 h-4 text-primary" />
                </div>
                <div className="text-lg font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-muted-foreground/80">
                  {stat.description}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
