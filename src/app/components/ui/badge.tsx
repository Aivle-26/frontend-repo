import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap text-xs font-medium transition-colors overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "text-primary [a&]:hover:text-primary/80",
        secondary:
          "text-secondary-foreground [a&]:hover:text-secondary-foreground/80",
        destructive:
          "text-destructive [a&]:hover:text-destructive/80",
        outline: "text-foreground [a&]:hover:text-foreground/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant }),
        className,
        "!rounded-none !border-0 !bg-transparent !p-0 !shadow-none hover:!bg-transparent",
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };