import type { D1Database, VectorizeIndex } from "@cloudflare/workers-types";
import { Type as T } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";

export type Env = {
	DB: D1Database;
	COURSES_INDEX: VectorizeIndex;
	PROGRAMS_INDEX: VectorizeIndex;

	OPENAI_KEY: string;
	RLIMIT_NAMESPACE: string;
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
		// const ip = c.req.header("cf-connecting-ip");
		// if (!ip) {
		// 	return c.text("Invalid request", 400);
		// }
		// const limit = await fetch(`https://rlimit.com/${c.env.RLIMIT_NAMESPACE}/50/1h/${ip}`);
		// if (!limit.ok) return c.text("Rate limit exceeded", 429);
		return next();
	},
	validator("form", (value, c) => {
		return Value.Check(MessageBody, value) ? value : c.text("Invalid request body", 400);
	}),
	async (c) => {
		const { id } = c.req.valid("param");
		const { message, schoolName } = c.req.valid("form");

		console.log(message, schoolName, id);
		return streamSSE(c, async (stream) => {
			const test =
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam sodales ipsum ac nunc dictum, rhoncus malesuada risus congue. Donec bibendum, sapien id consectetur efficitur, massa metus tincidunt nibh, ac dictum sem orci vitae felis. Pellentesque vel tempus felis. Aliquam erat volutpat. Maecenas nec condimentum ante. Suspendisse potenti. Aenean mauris nisi, elementum a sodales eu, iaculis eget odio. Sed pulvinar nisi a interdum cursus. In tortor purus, malesuada et tincidunt id, ornare vel metus."
					.split(" ").map((s) => s + " ");
			for (const word of test) {
				console.log(word);
				const random = Math.random() * 500;
				await stream.sleep(random);
				await stream.write(`event: token\ndata: ${encodeURIComponent(word)}\n\n`);
			}
			await stream.write(`event: end\n\n`);
			await stream.close();
		});
	},
);

export default app;
