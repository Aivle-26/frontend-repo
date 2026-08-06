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
          "!bg-gradient-to-r !from-emerald-600 !to-teal-600 !text-white shadow-sm shadow-emerald-900/15 hover:!from-emerald-700 hover:!to-teal-700 focus-visible:!ring-emerald-500/35 dark:!from-violet-600 dark:!to-purple-700 dark:!text-white dark:shadow-purple-950/45 dark:hover:!from-violet-500 dark:hover:!to-fuchsia-600 dark:focus-visible:!ring-violet-500/45",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "!border-emerald-300 !bg-white/70 !text-emerald-700 hover:!border-emerald-400 hover:!bg-emerald-50 hover:!text-emerald-800 focus-visible:!ring-emerald-500/30 dark:!border-violet-800/80 dark:!bg-black/30 dark:!text-violet-300 dark:hover:!border-violet-600 dark:hover:!bg-violet-950/65 dark:hover:!text-violet-100 dark:focus-visible:!ring-violet-500/35",
        secondary:
          "!bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100 focus-visible:!ring-emerald-500/30 dark:!bg-violet-950/65 dark:!text-violet-200 dark:hover:!bg-violet-900/75 dark:focus-visible:!ring-violet-500/35",
        ghost:
          "!text-emerald-700 hover:!bg-emerald-50 hover:!text-emerald-800 focus-visible:!ring-emerald-500/25 dark:!text-violet-300 dark:hover:!bg-violet-950/60 dark:hover:!text-violet-100 dark:focus-visible:!ring-violet-500/30",
        link:
          "!text-emerald-700 underline-offset-4 hover:!text-emerald-800 hover:underline dark:!text-violet-300 dark:hover:!text-fuchsia-200",
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