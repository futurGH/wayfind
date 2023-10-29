import { Transition } from "@headlessui/react";
import { schools } from "@wayfind/lib/schools";
import { useEffect, useState } from "react";
import { useResponsiveness } from "react-responsiveness";
import { Logo } from "./assets/logo";
import { Chat } from "./components/Chat";
import { ComboboxDemo as Combobox } from "./components/elements/Combobox";
import { Header } from "./components/Header";
import { useQueryParams } from "./lib/useQueryParams";
import { cn } from "./lib/util";

const schoolList = schools.map((school) => ({
	value: school.name.toLowerCase(),
	label: school.name.replace(" Secondary School", ""),
})).sort((a, b) => a.label.localeCompare(b.label));

const schoolValueToName = new Map(
	schools.map((school) => [school.name.toLowerCase(), school.name]),
);

export function App() {
	// Doesn't matter too much, just need a string that probably won't collide
	const sessionId = crypto.randomUUID()
		|| [...Array(16)].map(() => Math.random().toString(36)[2]).join("");

	const [queryParams, setQueryParam] = useQueryParams();
	const schoolName = queryParams.get("schoolName") ?? "";
	const fullSchoolName = schoolValueToName.get(schoolName);

	const schoolSelected = schoolName !== "";

	const { isOnly } = useResponsiveness();

	const [showChat, setShowChat] = useState(false);
	const [isError, setIsError] = useState(false);
	useEffect(() => {
		if (schoolSelected) {
			setTimeout(() => {
				if (fullSchoolName) {
					setIsError(false);
					setShowChat(true);
				} else setIsError(true);
			}, 300);
		} else setShowChat(false);
	}, [schoolSelected]);
	return (
		<div className="flex flex-col h-screen-fixed">
			<Header />
			<div className="flex flex-col flex-grow items-center mx-6 max-w-4xl lg:mx-auto lg:w-screen min-h-fit overflow-y-clip">
				<Logo
					className={cn(
						"mt-4 h-9 min-h-[2.25rem] w-48 justify-self-start text-slate-900 dark:text-slate-50",
						isOnly("xs") ? (schoolSelected ? "hide" : "show") : "",
					)}
				/>
				<div
					className={cn(
						"flex flex-col justify-center items-center transition-all duration-500",
						schoolSelected ? "h-12" : "h-full mt-8 sm:mt-0",
					)}
				>
					<div className={cn(schoolSelected && "mt-4 sm:mt-6")}>
						<label className="text-base leading-6 text-stone-900 dark:text-stone-50">
							<Transition
								enter="transition-opacity duration-200"
								enterFrom="opacity-0"
								enterTo="opacity-100"
								leave="transition-opacity duration-200"
								leaveFrom="opacity-100"
								leaveTo="opacity-0"
								show={!schoolSelected}
								as={"span"}
								className="block mb-2"
							>
								What high school do you go to?
							</Transition>
							<Combobox
								options={schoolList}
								value={schoolName}
								setValue={(value) => {
									setQueryParam("schoolName", value);
								}}
								placeholders={{
									button: "Select a school",
									search: "Search for a school...",
									none: "No schools found.",
								}}
							/>
						</label>
						<Transition
							enter="transition-opacity duration-200"
							enterFrom="opacity-0"
							enterTo="opacity-100"
							leave="transition-opacity duration-200"
							leaveFrom="opacity-100"
							leaveTo="opacity-0"
							show={!schoolSelected}
							as={"span"}
							className="block mt-2 text-xs text-stone-500 dark:text-stone-400"
						>
							This won't be stored anywhere.
						</Transition>
					</div>
				</div>
				{isError
					? (
						<div className="flex justify-center items-center w-full h-full">
							Sorry, something went wrong!
						</div>
					)
					: <Chat
						sessionId={sessionId}
						schoolName={fullSchoolName!}
						hidden={!showChat}
					/>}
			</div>
		</div>
	);
}
