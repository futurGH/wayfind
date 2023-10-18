import { configDotenv } from "dotenv";
import fs from "node:fs/promises";
import { sleep } from "openai/core";
import { generateSummary, validateEnv } from "../common";

configDotenv();

const args = process.argv.slice(2);

async function main() {
	const programFiles = args
		? args.map((id) => `${id}.program.json`)
		: await fs.readdir("./data/programs");

	for (const file of programFiles) {
		const programInfo = JSON.parse(
			(await fs.readFile(`./data/programs/${file}`, "utf-8")).toString(),
		) as ProgramJson;
		const id = file.split(".")[0];

		const modelName = validateEnv("SUMMARY_MODEL_ID");
		const summary = await generateSummary(programInfo, modelName);
		if (!summary) {
			console.warn("Could not generate summary for " + id);
			continue;
		}

		await fs.mkdir("./transformed/summaries", { recursive: true });
		await fs.writeFile("./transformed/summaries/" + id + ".summary.txt", summary);

		// Limit is 90k tokens/min, assuming ~2k tokens per summary, that's 45 summaries a minute
		// plus the response takes time, so 1.5s is more than enough
		await sleep(1500);
	}
}

await main();
