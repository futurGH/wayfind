import { pick } from "@wayfind/lib/object";
import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";
import fs from "node:fs/promises";

interface EmbeddingsLine {
	id: string;
	values: Array<number>;
	metadata: Record<string, string | number>;
}

const programSummaries = await fs.readdir("./transformed/summaries");

const embeddingsModel = new HuggingFaceTransformersEmbeddings({
	modelName: "Xenova/bge-base-en-v1.5",
});

await fs.mkdir("./transformed/embeddings/programs", { recursive: true });

const embeddings: Array<string> = [];

for (const summaryPath of programSummaries) {
	const programId = summaryPath.split(".")[0];

	const programInfoFile = await fs.readFile(`./data/programs/${programId}.program.json`, "utf-8")
		.then((f) => f.toString()).catch(() => null);
	if (!programInfoFile) throw new Error(`Could not find program info for ${programId}`);

	const programInfo = JSON.parse(programInfoFile) as ProgramJson;

	const summary = await fs.readFile(`./transformed/summaries/${summaryPath}`, "utf-8");

	const metadata = {
		...pick(programInfo, "university", "name", "ouacCode", "degree"),
		text: summary,
	};

	const embeddingValues = (await embeddingsModel.embedDocuments([summary]))[0];
	const programEmbedding: EmbeddingsLine = {
		id: `program-${programId}`,
		values: embeddingValues,
		metadata,
	};
	embeddings.push(JSON.stringify(programEmbedding));
}

await fs.writeFile(
	`./transformed/embeddings/programs/programs.embeddings.ndjson`,
	embeddings.join("\n"),
);
