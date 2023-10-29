"use client";

import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import * as React from "react";

import { cn } from "../../lib/util";
import { Button } from "./Button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "./Command";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

interface ComboboxProps {
	options: Array<{ value: string; label: string }>;
	className?: string;
	value: string;
	setValue: (value: string) => void;
	placeholders?: { button?: string; search?: string; none?: string };
}

export function ComboboxDemo({ options, value, setValue, className, placeholders }: ComboboxProps) {
	placeholders = {
		button: placeholders?.button || "Select an item",
		search: placeholders?.search || "Search for an item...",
		none: placeholders?.none || "No items found.",
	};
	const [open, setOpen] = React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					role="combobox"
					aria-expanded={open}
					className={cn(
						"w-60 justify-between gap-8 text-stone-500 dark:text-stone-400",
						value && "text-stone-900 dark:text-stone-50",
						className,
					)}
				>
					{value
						? options.find((option) =>
							option.value.toLowerCase() === value.toLowerCase()
						)?.label
						: placeholders.button}
					<ChevronDownIcon
						className={cn(
							"ml-2 h-4 w-4 shrink-0 transition-transform",
							open && "mt-1 rotate-180",
						)}
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="p-0 w-60">
				<Command>
					<CommandInput placeholder={placeholders.search} />
					<CommandEmpty>{placeholders.none}</CommandEmpty>
					<CommandGroup>
						{options.map((option) => (
							<CommandItem
								key={option.value}
								value={option.value}
								onSelect={(currentValue) => {
									setValue(currentValue === value ? "" : currentValue);
									setOpen(false);
								}}
							>
								<CheckIcon
									className={cn(
										"mr-2 h-4 w-4",
										value === option.value ? "opacity-100" : "opacity-0",
									)}
								/>
								{option.label}
							</CommandItem>
						))}
					</CommandGroup>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
