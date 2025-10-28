import type { D1Database, KVNamespace, VectorizeIndex } from "@cloudflare/workers-types";
import { WorkersKVStore } from "@hono-rate-limiter/cloudflare";
import { CloudflareWorkersAIEmbeddings } from "@langchain/cloudflare";
import { XataChatMessageHistory } from "@langchain/community/stores/message/xata";
import { XataVectorSearch } from "@langchain/community/vectorstores/xata";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { Type as T } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { BaseClient as XataClient } from "@xata.io/client";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { BufferMemory } from "langchain/memory";
import { z } from "zod";

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

		const memory = new BufferMemory({
			returnMessages: true,
			chatHistory,
			memoryKey: "chat_history",
		});

		const llm = new ChatOpenAI({
			openAIApiKey: c.env.OPENAI_KEY,
			modelName: "gpt-5",
			reasoning: { effort: "minimal", summary: null },
			useResponsesApi: true,
			streaming: true,
			verbose: true,
		});

		const coursesRetriever = coursesStore.asRetriever({ filter: { schoolName } });
		const coursesRetrieverTool = tool(
			// @ts-expect-error
			async ({ input }: { input: string }) => {
				const docs = await coursesRetriever.invoke(input);
				return docs.map((doc) => doc.pageContent).join("\n\n");
			},
			{
				name: "search_courses",
				description: `Useful for information on courses at ${schoolName}.`,
				schema: z.object({ input: z.string() }),
			},
		);

		const programsRetriever = programsStore.asRetriever();
		const programsRetrieverTool = tool(
			// @ts-expect-error
			async ({ input }: { input: string }) => {
				const docs = await programsRetriever.invoke(input);
				return docs.map((doc) => doc.pageContent).join("\n\n");
			},
			{
				name: "search_programs",
				description: "Useful for information on university/college programs.",
				schema: z.object({ input: z.string() }),
			},
		);

		const tools = [programsRetrieverTool, coursesRetrieverTool];
		const agent = createToolCallingAgent({
			// @ts-expect-error — missing deprecated methods
			llm,
			tools,
			prompt: ChatPromptTemplate.fromMessages([
				[
					"system",
					`Acting as a guidance counselor for ${schoolName}, your job is to guide students through their academic and career choices using your extensive knowledge of the school’s course offerings and all Ontario college and university programs. Refer to specific high school courses by both their name and their code whenever possible. Make sure to use functions wherever possible for accurate data. Answer questions to the fullest of your knowledge. Be concise, aiming for 1-2 brief paragraphs in your response.`,
				],
				["placeholder", "{chat_history}"],
				["human", "{input}"],
				["placeholder", "{agent_scratchpad}"],
			]),
		});
		const executor = new AgentExecutor({
			agent,
			tools,
			maxIterations: 12,
			earlyStoppingMethod: "generate",
		});

		return streamSSE(c, async (sseStream) => {
			await executor.stream({ input: message }, {
				callbacks: [{
					handleLLMNewToken: async (token) => {
						if (!token.length) return;
						await sseStream.write(
							`event: token\ndata: ${encodeURIComponent(token)}\n\n`,
						);
					},
					handleAgentEnd: async (action) => {
						let end = `event: end\n`;
						if ("output" in action.returnValues) {
							end += `data: ${encodeURIComponent(`${action.returnValues.output}`)}\n`;
						}
						end += `\n`;
						await sseStream.write(end);
						await sseStream.close();
					},
					handleAgentAction: async (action) => {
						await sseStream.write(
							`event: action\ndata: ${encodeURIComponent(action.tool)}\n\n`,
						);
					},
					handleChainError: async (err) => {
						console.error(err);
						await sseStream.write(
							`event: error\ndata: ${encodeURIComponent(`${err}`)}\n\n`,
						);
						await sseStream.close();
					},
				}],
			});
		});
	},
);

export default app;
