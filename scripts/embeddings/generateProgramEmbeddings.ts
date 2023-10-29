import { pick } from "@wayfind/lib/object";
import { configDotenv } from "dotenv";
import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";
import fs from "node:fs/promises";
import { removeNonUtf8 } from "../common";
import { getXataClient, Programs as XataProgram } from "../xata";

configDotenv();

const xata = getXataClient();

const programSummaries = await fs.readdir("./transformed/summaries");

const embeddingsModel = new HuggingFaceTransformersEmbeddings({
	modelName: "Xenova/bge-base-en-v1.5",
});

const embeddings: Array<XataProgram> = [];

for (const summaryPath of programSummaries) {
	const programId = summaryPath.split(".")[0];

	const programInfoFile = await fs.readFile(`./data/programs/${programId}.program.json`, "utf-8")
		.then((f) => f.toString()).catch(() => null);
	if (!programInfoFile) throw new Error(`Could not find program info for ${programId}`);

	const programInfo = JSON.parse(programInfoFile) as ProgramJson;

	const summary = await fs.readFile(`./transformed/summaries/${summaryPath}`, "utf-8");

	const embeddingValues = (await embeddingsModel.embedDocuments([summary]))[0];
	const programEmbedding = {
		id: `program-${programId}`,
		content: removeNonUtf8(summary),
		embedding: embeddingValues,
		...pick(programInfo, "university", "name", "ouacCode"),
	};
	embeddings.push(programEmbedding);
}

await xata.db.programs.createOrReplace(embeddings);
