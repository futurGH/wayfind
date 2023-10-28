import type { D1Database, VectorizeIndex } from "@cloudflare/workers-types";
import { Type as T } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { BaseClient as XataClient } from "@xata.io/client";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { CloudflareWorkersAIEmbeddings } from "langchain/embeddings/cloudflare_workersai";
import { BufferMemory } from "langchain/memory";
import { XataChatMessageHistory } from "langchain/stores/message/xata";
import { DynamicTool } from "langchain/tools";
import { formatDocumentsAsString } from "langchain/util/document";
import { XataVectorSearch } from "langchain/vectorstores/xata";

export type Env = {
	DB: D1Database;
	COURSES_INDEX: VectorizeIndex;
	PROGRAMS_INDEX: VectorizeIndex;
	AI: Fetcher;

	OPENAI_KEY: string;
	RLIMIT_NAMESPACE: string;
	XATA_API_KEY: string;
	XATA_DB_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

const MessageParams = T.Object({ id: T.String() });
const MessageBody = T.Object({ message: T.String(), schoolName: T.String() });

app.use("/*", cors({ origin: "*", credentials: false }));

app.post(
	"/session/:id",
	validator("param", (value, c) => {
		return Value.Check(MessageParams, value)
			? value
			: c.text("Invalid request parameters", 400);
	}),
	async (c, next) => {
		const ip = c.req.header("cf-connecting-ip");
		if (!ip) {
			return c.text("Invalid request", 400);
		}
		const limit = await fetch(`https://rlimit.com/${c.env.RLIMIT_NAMESPACE}/50/1h/${ip}`);
		if (!limit.ok) return c.json(await limit.json(), 429);
		return next();
	},
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
			modelName: "gpt-4",
			temperature: 0.9,
			streaming: true,
			verbose: true,
		});

		const coursesRetriever = coursesStore.asRetriever({ filter: { schoolName } });
		const coursesRetrieverTool = new DynamicTool({
			name: "search_courses",
			description: `Useful for information on courses at ${schoolName}.`,
			func: async (input, runManager) => {
				const docs = await coursesRetriever.getRelevantDocuments(
					input,
					runManager?.getChild("retriever"),
				);
				return formatDocumentsAsString(docs, "\n");
			},
		});

		const programsRetriever = programsStore.asRetriever();
		const programsRetrieverTool = new DynamicTool({
			name: "search_programs",
			description: "Useful for information on university/college programs.",
			func: async (input, runManager) => {
				const docs = await programsRetriever.getRelevantDocuments(
					input,
					runManager?.getChild("retriever"),
				);
				return formatDocumentsAsString(docs, "\n");
			},
		});

		const agent = await initializeAgentExecutorWithOptions(
			[programsRetrieverTool, coursesRetrieverTool],
			llm,
			{
				memory,
				agentType: "openai-functions",
				agentArgs: {
					prefix:
						`Acting as a guidance counselor for ${schoolName}, your job is to guide students through their academic and career choices using your extensive knowledge of the school’s course offerings and all Ontario college and university programs. Refer to specific high school courses by both their name and their code whenever possible. Make sure to use functions wherever possible for accurate data. Answer questions to the fullest of your knowledge. Be concise, aiming for 1-2 brief paragraphs in your response.`,
				},
				verbose: true,
				maxIterations: 12,
				earlyStoppingMethod: "generate",
				handleParsingErrors:
					"Try wording your query to the tool differently and try again.",
			},
		);

		return streamSSE(c, async (sseStream) => {
			await agent.stream({ input: message }, {
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
