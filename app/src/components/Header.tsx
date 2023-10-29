import {
	GitHubLogoIcon,
	HeartFilledIcon as HeartIcon,
	MoonIcon,
	SunIcon,
} from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { useResponsiveness } from "react-responsiveness";

const Divider = () => <div className="w-1 h-1 rounded-full bg-stone-700 dark:bg-stone-400" />;

export function Header() {
	const [isDarkMode, setIsDarkMode] = useState(false);
	useEffect(() => {
		document.body.classList.toggle("dark", isDarkMode);
	}, [isDarkMode]);
	const { isMin } = useResponsiveness();
	const madeWithText = isMin("sm") ? "made with" : "w/";
	return (
		<header className="flex flex-row-reverse gap-3 justify-center items-center px-4 mt-2 w-full h-8 sm:flex-row sm:justify-end sm:h-6 text-stone-700 dark:text-stone-400">
			<a
				href="https://abdullahs.ca"
				className="inline-flex gap-1 items-center text-sm font-medium hover:text-sienna hover:dark:text-stone-500"
			>
				{madeWithText} <HeartIcon className="w-6 h-6 sm:w-5 sm:h-5" />
			</a>
			<Divider />
			<a
				href="https://todo"
				className="flex justify-center items-center w-8 h-8 hover:text-sienna hover:dark:text-stone-500"
			>
				<GitHubLogoIcon className="w-6 h-6 sm:w-5 sm:h-5" />
			</a>
			<Divider />
			<button
				onClick={() => {
					setIsDarkMode(!isDarkMode);
				}}
				className="flex justify-center items-center w-8 h-8 hover:text-sienna hover:dark:text-stone-500"
			>
				{isDarkMode
					? <SunIcon className="w-6 h-6 sm:w-5 sm:h-5" />
					: <MoonIcon className="w-6 h-6 sm:w-5 sm:h-5" />}
			</button>
		</header>
	);
}
