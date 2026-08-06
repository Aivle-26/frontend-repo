import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "!bg-gradient-to-r !from-emerald-600 !to-teal-600 !text-white shadow-sm shadow-emerald-900/15 hover:!from-emerald-700 hover:!to-teal-700 focus-visible:!ring-emerald-500/35 dark:!from-emerald-500 dark:!to-teal-500 dark:!text-emerald-950 dark:hover:!from-emerald-400 dark:hover:!to-teal-400",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "!border-emerald-300 !bg-white/70 !text-emerald-700 hover:!border-emerald-400 hover:!bg-emerald-50 hover:!text-emerald-800 focus-visible:!ring-emerald-500/30 dark:!border-emerald-700 dark:!bg-emerald-950/25 dark:!text-emerald-300 dark:hover:!bg-emerald-900/55 dark:hover:!text-emerald-100",
        secondary:
          "!bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100 focus-visible:!ring-emerald-500/30 dark:!bg-emerald-900/60 dark:!text-emerald-100 dark:hover:!bg-emerald-800/75",
        ghost:
          "!text-emerald-700 hover:!bg-emerald-50 hover:!text-emerald-800 focus-visible:!ring-emerald-500/25 dark:!text-emerald-300 dark:hover:!bg-emerald-900/50 dark:hover:!text-emerald-100",
        link:
          "!text-emerald-700 underline-offset-4 hover:!text-emerald-800 hover:underline dark:!text-emerald-300 dark:hover:!text-emerald-200",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };