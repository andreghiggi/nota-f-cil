import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  id: string;
  label: string;
  description?: string;
}

interface Props {
  steps: OnboardingStep[];
  current: number;
  completed: Set<number>;
}

export function OnboardingStepper({ steps, current, completed }: Props) {
  return (
    <ol className="flex items-start justify-between gap-2">
      {steps.map((step, idx) => {
        const isCompleted = completed.has(idx);
        const isActive = idx === current;
        return (
          <li key={step.id} className="flex-1 flex flex-col items-center text-center relative">
            {idx > 0 && (
              <div
                className={cn(
                  "absolute top-4 right-1/2 w-full h-0.5 -z-0",
                  completed.has(idx - 1) || isActive ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                isCompleted
                  ? "bg-primary border-primary text-primary-foreground"
                  : isActive
                  ? "bg-background border-primary text-primary"
                  : "bg-background border-border text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <div className="mt-2">
              <p
                className={cn(
                  "text-xs font-medium",
                  isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-[10px] text-muted-foreground hidden md:block">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
