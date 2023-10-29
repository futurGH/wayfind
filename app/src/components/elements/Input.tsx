import * as React from "react";

import { cn } from "../../lib/util";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex h-10 w-full rounded-md border border-stone-900/30 bg-white px-4 py-1 text-sm text-stone-900",
					"placeholder:text-stone-500",
					"ring-opacity-0 transition-outline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-opacity-100",
					"disabled:cursor-not-allowed disabled:opacity-50",
					"dark:border-stone-50/20 dark:bg-stone-900 dark:text-stone-50 dark:placeholder:text-stone-400 dark:focus-visible:ring-stone-500",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
