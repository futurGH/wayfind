import { Transition } from "@headlessui/react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { PaperPlaneIcon } from "@radix-ui/react-icons";
import { formatDistance } from "date-fns";
import { FormEvent, useReducer, useRef, useState } from "react";
import { Compass } from "../assets/Compass";
import { cn } from "../lib/util";
import ScrollableFeed from "../vendor/react-scrollable-feed";
import { Button } from "./elements/Button";
import { Textarea } from "./elements/Textarea";

const API_URL = import.meta.env.VITE_API_URL;

type Message = { from: "human" | "ai"; text: string; error?: boolean };

interface ChatProps {
	sessionId: string;
	schoolName: string;
	hidden?: boolean;
}

const formatMessage = (message: Message): Message => ({
	...message,
	text: message.text.replace(/\r\n|\r|\n/g, "<br />").replace(
		/\[(?<text>.+?)\]\((?<link>.+?)\)/g,
		`<a href="$<link>" class="text-underline">$<text></a>`,
	),
});

const MessagesPlaceholder = () => {
	return (
		<>
			<div>
				<h4 className="mb-2 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
					Ask away.
				</h4>
				<span className="text-base font-medium text-stone-700 dark:text-stone-300">
					Wayfind knows about your school's courses and every university in Ontario.
				</span>
			</div>
			<div className="flex flex-col gap-4 w-full text-sm italic sm:gap-3 sm:text-base text-stone-600 dark:text-stone-400">
				<span>“What grade 11 course should I choose if I want to build a computer?”</span>
				<span>
					“What should my average be to study biochemistry at the University of Windsor?”
				</span>
				<span>
					“What universities should I apply to if I want to become a forensic scientist?
					What grade 11 courses do I have to take?”
				</span>
			</div>
		</>
	);
};

export function Chat({ sessionId, schoolName, hidden = false }: ChatProps) {
	async function handleSend(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (isStreaming) return;

		const formData = new FormData(e.currentTarget);
		formData.set("schoolName", schoolName);

		setInput("");

		dispatchMessage({
			type: "add",
			message: { from: "human", text: String(formData.get("message")).trim() },
		});
		dispatchMessage({ type: "add", message: { from: "ai", text: "" } });

		await fetchEventSource(API_URL + "/session/" + sessionId, {
			method: "POST",
			openWhenHidden: true,
			body: formData,
			// eslint-disable-next-line @typescript-eslint/require-await
			onopen: async (res) => {
				const contentType = res.headers.get("content-type");
				if (contentType?.startsWith("text/event-stream")) {
					setIsStreaming(true);
					setIsLoading(true);
				} else {
					throw res;
				}
			},
			onerror: (e) => {
				setIsStreaming(false);
				setIsLoading(false);
				throw e;
			},
			onmessage: (res) => {
				if (res.event === "error") {
					throw decodeURIComponent(res.data || "Unknown error");
				}
				if (res.event === "end" && res.data) {
					dispatchMessage({
						type: "set",
						message: { from: "ai", text: decodeURIComponent(res.data) },
					});
				}
				if (res.event === "action") {
					switch (decodeURIComponent(res.data)) {
						case "search_programs":
							setLlmStatus("Searching for university programs...");
							break;
						case "search_courses":
							setLlmStatus("Searching for courses...");
							break;
						default:
							setLlmStatus("Thinking...");
							break;
					}
				}
				if (res.event !== "token") {
					return;
				}
				if (!("data" in res) || res.data == null) throw res;

				if (isLoading) setIsLoading(false);
				const token = decodeURIComponent(res.data);
				dispatchMessage({ type: "append", token });
			},
			onclose: () => {
				setIsStreaming(false);
				setIsLoading(false);
			},
		}).catch(async (e) => {
			console.error(e);
			if (e instanceof Response) {
				if (e.status === 429) {
					const body = await e.json();
					const distance = formatDistance(body.remaining, Date.now());
					dispatchMessage({
						type: "set",
						message: {
							from: "ai",
							text: "Sorry, I'm not made of cash! You'll have to try again in "
								+ distance + ".",
							error: true,
						},
					});
				}
			}
			dispatchMessage({
				type: "set",
				message: { from: "ai", text: "Sorry, something went wrong!", error: true },
			});
		}).finally(() => {
			setIsStreaming(false);
			setIsLoading(false);
			setLlmStatus("Thinking...");
		});
	}

	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [llmStatus, setLlmStatus] = useState("Thinking...");

	const [messages, dispatchMessage] = useReducer(
		(
			state: Array<Message>,
			action: { type: "add"; message: Message } | { type: "append"; token: string } | {
				type: "set";
				message: Message;
			},
		) => {
			let lastMessage = state[state.length - 1];
			switch (action.type) {
				case "add":
					if (
						lastMessage && lastMessage.from === "ai"
						&& lastMessage.from === action.message.from
					) {
						for (const message of [lastMessage, action.message]) {
							if (!message.text.length || message.error) {
								return state.slice(0, -1).concat(formatMessage(action.message));
							}
						}
					}
					return state.concat(action.message);
				case "append":
					if (!lastMessage) return state;
					if (lastMessage.from !== "ai") {
						lastMessage = { from: "ai", text: "" };
						state.push(lastMessage);
					}
					const newText = lastMessage.text + action.token;
					return state.slice(0, -1).concat({ ...lastMessage, text: newText });
				case "set":
					return state.slice(0, -1).concat(formatMessage(action.message));
				default:
					return state;
			}
		},
		[],
	);

	const formRef = useRef<HTMLFormElement>(null);

	return (
		<Transition
			show={!hidden}
			leave="transition-opacity ease-in-out duration-200"
			leaveFrom="opacity-100"
			leaveTo="opacity-0"
			className="flex flex-col justify-end items-center pb-8 w-full max-h-full duration-200 sm:pb-16 h-screen-fixed overflow-y-clip animate-in fade-in slide-in-from-bottom-8 fade-out-up"
		>
			{/* @ts-expect-error — weird overloads, allows children or className but not both */}
			<ScrollableFeed
				className={cn(
					"overflow-y-scroll pb-4 pt-4 sm:pt-6 h-auto space-y-8 w-full scrollbar-none",
					!messages.length && "hidden",
				)}
			>
				{messages.map((message, i) => (
					<Transition
						appear={true}
						show={!!messages.length}
						enter={cn(
							"transition-opacity duration-200",
							messages.length <= 2 && "delay-150",
						)}
						enterFrom="opacity-0"
						enterTo="opacity-100"
						className="flex relative w-full"
						key={i}
					>
						{message.from === "ai" && (
							<Compass
								className={cn(
									"mr-2 -mt-2 w-5 h-5",
									(i === messages.length - 1 && (isLoading || isStreaming))
										&& "animate-spin",
								)}
							/>
						)}
						<span
							className={cn(
								"sm:max-w-prose max-w-full w-10/12 sm:w-auto break-words text-base",
								message.from === "human"
									? "text-right ml-auto text-stone-500 dark:text-stone-400"
									: "text-left text-stone-900 dark:text-stone-50",
								"error" in message && message.error
									&& "text-red-400 dark:text-red-200",
							)}
							dangerouslySetInnerHTML={{ __html: message.text || llmStatus }}
						>
						</span>
					</Transition>
				))}
			</ScrollableFeed>
			<Transition
				show={!messages.length}
				leave="transition-opacity duration-100"
				leaveFrom="opacity-100"
				leaveTo="opacity-0"
				className="flex flex-col gap-10 pb-8 w-full text-center"
			>
				<MessagesPlaceholder />
			</Transition>
			<form
				ref={formRef}
				className="inline-flex gap-1.5 items-end w-full"
				onSubmit={(e) => {
					setIsLoading(true);
					if (!input.trim().length) return;
					handleSend(e).catch(() => {});
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
						e.preventDefault();
						formRef.current?.requestSubmit();
					}
				}}
			>
				<Textarea
					name="message"
					autoFocus
					maxRows={6}
					placeholder="Ask a question"
					value={input}
					onChange={(e) => {
						setInput(e.currentTarget.value);
					}}
					className="text-base shadow-sm"
				/>
				<Button
					type="submit"
					disabled={isStreaming}
					className={cn(
						"h-10 w-10 border border-stone-700 bg-gradient-to-br p-2 shadow-sm transition-all dark:bg-stone-50",
						"from-stone-600 from-0% to-stone-900 to-70% text-stone-50 hover:from-stone-700 hover:to-stone-900 hover:text-stone-200 active:from-stone-800 active:to-stone-900 active:text-stone-400",
						"dark:border-stone-300 dark:bg-white dark:bg-none dark:text-stone-900 active:dark:bg-stone-200 active:dark:text-stone-400",
						"hover:dark:bg-stone-200 hover:dark:text-stone-600",
					)}
				>
					<PaperPlaneIcon />
				</Button>
			</form>
		</Transition>
	);
}
