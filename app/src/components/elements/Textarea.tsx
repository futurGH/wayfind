import * as React from "react";
import TextareaAutosize, { TextareaAutosizeProps } from "react-textarea-autosize";

import { cn } from "../../lib/util";

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
	({ className, ...props }, ref) => {
		return (
			<TextareaAutosize
				className={cn(
					"flex min-h-[2.5rem] w-full rounded-md border border-stone-900/30 bg-white px-4 py-2 text-sm text-stone-900",
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
