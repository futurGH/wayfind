import type { D1Database, KVNamespace, VectorizeIndex } from "@cloudflare/workers-types";
import { WorkersKVStore } from "@hono-rate-limiter/cloudflare";
import { CloudflareWorkersAIEmbeddings } from "@langchain/cloudflare";
import { XataChatMessageHistory } from "@langchain/community/stores/message/xata";
import { XataVectorSearch } from "@langchain/community/vectorstores/xata";
import { Type as T } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { BaseClient as XataClient } from "@xata.io/client";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";
import OpenAI from "openai";

export type Env = {
	Variables: { rateLimit: boolean };
	Bindings: {
		DB: D1Database;
		COURSES_INDEX: VectorizeIndex;
		PROGRAMS_INDEX: VectorizeIndex;
		AI: Fetcher;
		RLIMIT_KV: KVNamespace;

		OPENAI_KEY: string;
		XATA_API_KEY: string;
		XATA_DB_URL: string;
	};
};

const app = new Hono<Env>();

const MessageParams = T.Object({ id: T.String() });
const MessageBody = T.Object({ message: T.String(), schoolName: T.String() });

app.use("/*", cors({ origin: "*", credentials: false }));

app.use((c, next) =>
	rateLimiter<Env>({
		windowMs: 60 * 60 * 1000, // 1h
		limit: 50,
		keyGenerator: (c) => c.req.header("cf-connecting-ip") ?? "",
		// @ts-expect-error — type mismatch?
		store: new WorkersKVStore({ namespace: c.env.RLIMIT_KV }),
	})(c, next)
);

function toStringContent(content: unknown): string {
	if (typeof content === "string") return content;
	try {
		return JSON.stringify(content);
	} catch {
		return String(content ?? "");
	}
}

app.post(
	"/session/:id",
	validator("param", (value, c) => {
		return Value.Check(MessageParams, value)
			? value
			: c.text("Invalid request parameters", 400);
	}),
	validator("form", (value, c) => {
		return Value.Check(MessageBody, value) ? value : c.text("Invalid request body", 400);
	}),
	async (c) => {
		const { id } = c.req.valid("param");
		const { message, schoolName } = c.req.valid("form");

		const embeddings = new CloudflareWorkersAIEmbeddings({
			// @ts-expect-error — type mismatch?
			binding: c.env.AI,
			modelName: "@cf/baai/bge-base-en-v1.5",
		});

		const xata = new XataClient({
			apiKey: c.env.XATA_API_KEY,
			databaseURL: c.env.XATA_DB_URL,
			branch: "main",
		});
		const coursesStore = new XataVectorSearch(embeddings, { client: xata, table: "courses" });
		const programsStore = new XataVectorSearch(embeddings, { client: xata, table: "programs" });

		const chatHistory = new XataChatMessageHistory({
			createTable: true,
			table: "messages",
			sessionId: id,
			client: xata,
			apiKey: c.env.XATA_API_KEY,
		});

		const openai = new OpenAI({ apiKey: c.env.OPENAI_KEY });

		const coursesRetriever = coursesStore.asRetriever({ filter: { schoolName } });
		const programsRetriever = programsStore.asRetriever();

		const tools = [{
			type: "function",
			function: {
				name: "search_courses",
				description: `Useful for information on courses at ${schoolName}.`,
				parameters: {
					type: "object",
					properties: {
						input: {
							type: "string",
							description: "Natural language query about courses",
						},
					},
					required: ["input"],
				},
			},
		}, {
			type: "function",
			function: {
				name: "search_programs",
				description: "Useful for information on university/college programs.",
				parameters: {
					type: "object",
					properties: {
						input: {
							type: "string",
							description: "Natural language query about programs",
						},
					},
					required: ["input"],
				},
			},
		}] satisfies OpenAI.Chat.ChatCompletionTool[];

		const executeTool = async (
			name: string,
			args?: { input: string } | undefined,
		): Promise<string> => {
			if (name === "search_courses") {
				const q = String(args?.input ?? "");
				const docs = await coursesRetriever.invoke(q);
				return docs.map((d) => d.pageContent).join("\n\n");
			}
			if (name === "search_programs") {
				const q = String(args?.input ?? "");
				const docs = await programsRetriever.invoke(q);
				return docs.map((d) => d.pageContent).join("\n\n");
			}
			return "";
		};

		const lcMessages = await chatHistory.getMessages();
		const historyMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> =
			[];
		for (const m of lcMessages) {
			const type = m.getType();
			if (type === "human") {
				historyMessages.push({ role: "user", content: toStringContent(m.content) });
			} else if (type === "ai") {
				historyMessages.push({ role: "assistant", content: toStringContent(m.content) });
			} else if (type === "system") {
				historyMessages.push({ role: "system", content: toStringContent(m.content) });
			}
		}

		const systemPrompt =
			`Acting as a guidance counselor for ${schoolName}, your job is to guide students through their academic and career choices using your extensive knowledge of the school’s course offerings and all Ontario college and university programs. Refer to specific high school courses by both their name and their code whenever possible. Make sure to use functions wherever possible for accurate data. Answer questions to the fullest of your knowledge. Be concise, aiming for 1-2 brief paragraphs in your response.`;

		return streamSSE(c, async (sseStream) => {
			try {
				await chatHistory.addUserMessage(message);

				const messages: any[] = [
					{ role: "system", content: systemPrompt },
					...historyMessages,
					{ role: "user", content: message },
				];

				const model = "gpt-5-chat-latest";
				const maxToolIterations = 10;

				let finalText = "";
				let iterations = 0;

				while (iterations < maxToolIterations) {
					iterations++;

					const toolPlan = await openai.chat.completions.create({
						model,
						temperature: 0.3,
						messages,
						tools,
						tool_choice: "auto",
					});

					const msg = toolPlan.choices[0]?.message;
					const toolCalls = msg?.tool_calls ?? [];

					if (!toolCalls.length) {
						if (msg?.content) {
							messages.push({ role: "assistant", content: msg.content });
						}

						const stream = await openai.chat.completions.create({
							model,
							temperature: 0.3,
							messages,
							stream: true,
						});

						for await (const part of stream as any) {
							const delta = part?.choices?.[0]?.delta;
							const tokenChunk: string | undefined = delta?.content;
							if (tokenChunk) {
								finalText += tokenChunk;
								await sseStream.write(
									`event: token\ndata: ${encodeURIComponent(tokenChunk)}\n\n`,
								);
							}
						}

						let end = `event: end\n`;
						if (finalText.length) {
							end += `data: ${encodeURIComponent(finalText)}\n`;
						}
						end += `\n`;
						await sseStream.write(end);

						if (finalText.length) {
							await chatHistory.addAIMessage(finalText);
						}

						await sseStream.close();
						return;
					}

					messages.push({
						role: "assistant",
						content: msg?.content ?? "",
						tool_calls: toolCalls.map((tc: any) => ({
							id: tc.id,
							type: "function",
							function: {
								name: tc.function?.name,
								arguments: tc.function?.arguments ?? "{}",
							},
						})),
					});

					for (const tc of toolCalls) {
						const name: string = tc.function?.name;
						let args: any = {};
						try {
							args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
						} catch (e) {
							args = {};
						}

						await sseStream.write(
							`event: action\ndata: ${encodeURIComponent(name)}\n\n`,
						);

						const result = await executeTool(name, args);
						messages.push({
							role: "tool",
							tool_call_id: tc.id,
							content: result || "(no results)",
						});
					}
				}

				const fallback = "I couldn't complete the request at this time.";
				await sseStream.write(`event: token\ndata: ${encodeURIComponent(fallback)}\n\n`);
				await sseStream.write(`event: end\ndata: ${encodeURIComponent(fallback)}\n\n`);
				await chatHistory.addAIMessage(fallback);
				await sseStream.close();
			} catch (err: any) {
				console.error(err);
				await sseStream.write(
					`event: error\ndata: ${encodeURIComponent(String(err?.message ?? err))}\n\n`,
				);
				await sseStream.close();
			}
		});
	},
);

export default app;
