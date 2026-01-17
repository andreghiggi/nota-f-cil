import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "destructive";
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  variant = "default" 
}: MetricCardProps) {
  const variantStyles = {
    default: "border-l-primary",
    success: "border-l-success",
    warning: "border-l-warning",
    destructive: "border-l-destructive",
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-3 w-3" />;
    if (trend.value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.value > 0) return "text-success";
    if (trend.value < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <div className={cn(
      "card-elevated metric-card border-l-4 p-5",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      
      {trend && (
        <div className={cn("flex items-center gap-1 mt-3 text-xs font-medium", getTrendColor())}>
          {getTrendIcon()}
          <span>{Math.abs(trend.value)}%</span>
          <span className="text-muted-foreground font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
