import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "../../lib/util";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(
					"inline-flex items-center justify-center whitespace-nowrap rounded-md border border-stone-900/30 px-4 py-1 text-sm leading-7 ring-offset-white transition-colors",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2",
					"disabled:pointer-events-none disabled:opacity-50",
					"hover:bg-stone-100",
					"dark:border-stone-50/20 dark:text-stone-400 dark:ring-offset-stone-950 dark:hover:bg-stone-700 dark:hover:text-stone-300 dark:focus-visible:ring-stone-300",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
