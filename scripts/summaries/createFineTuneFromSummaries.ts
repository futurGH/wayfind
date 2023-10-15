import { configDotenv } from "dotenv";
import { createReadStream } from "fs";
import fs from "node:fs/promises";
import OpenAI from "openai";

const { parsed: env } = configDotenv() as { parsed: object };
if (!("OPENAI_KEY" in env) || typeof env.OPENAI_KEY !== "string") {
	throw new Error("Environment variable OPENAI_KEY not set");
}

// Will throw if file does not exist
await fs.stat("./transformed/summary-finetune.jsonl");

const openai = new OpenAI({ apiKey: env.OPENAI_KEY });

const file = await openai.files.create({
	file: createReadStream("./transformed/summary-finetune.jsonl"),
	purpose: "fine-tune",
});

const allJobs = await openai.fineTuning.jobs.list();
const existingJob = allJobs.data.find((job) =>
	job.training_file === file.id && job.finished_at === null
);

if (existingJob) {
	throw new Error("Fine tune job is already running");
}

const fineTune = await openai.fineTuning.jobs.create({
	training_file: file.id,
	model: "gpt-3.5-turbo",
	suffix: "guaidance-summary",
});

console.log("Fine tune job started");
console.log("Job ID:", fineTune.id);
console.log("Training file ID:", file.id);
