import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconText: string;
  value: React.ReactNode;
  label: string;
}

export function StatCard({ icon, iconBg, iconText, value, label }: StatCardProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {React.cloneElement(icon as React.ReactElement, {
            className: `h-5 w-5 ${iconText}`,
          })}
        </div>
        <div className="min-w-0">
          {typeof value === 'string' || typeof value === 'number' ? (
            <p className="text-2xl font-semibold truncate">{value}</p>
          ) : (
            value
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
