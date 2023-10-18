import { editor, expand } from "@inquirer/prompts";
import { nRandom } from "@wayfind/lib/number";
import { configDotenv } from "dotenv";
import fs from "node:fs/promises";
import { browser, generateSummary } from "../common";

configDotenv();

const MODEL_NAME = "gpt-4";

async function main() {
	const programFiles = await fs.readdir("./data/programs");
	const randomProgramFiles = nRandom(0, programFiles.length - 1, 20).map((n) => programFiles[n]);
	const programs = randomProgramFiles.map(async (file) => {
		const info = JSON.parse(
			(await fs.readFile(`./data/programs/${file}`, "utf-8")).toString(),
		) as ProgramJson;
		return { id: file.split(".")[0], info };
	});

	for await (const program of programs) {
		let summary: string | null = "";
		let shouldSave = "";
		while (shouldSave !== "yes") {
			summary = await generateSummary(program.info, MODEL_NAME);
			if (!summary) continue;

			console.log("Info: " + JSON.stringify(program, null, 2));
			console.log("Summary: " + summary);

			shouldSave = await expand({
				message: "Save this summary",
				default: "y",
				choices: [
					{ key: "y", name: "Yes", value: "yes" },
					{ key: "r", name: "Redo", value: "redo" },
					{ key: "s", name: "Skip", value: "skip" },
					{ key: "e", name: "Edit", value: "edit" },
				],
			});

			if (shouldSave === "redo") continue;
			else if (shouldSave === "skip") break;
			else if (shouldSave === "edit") {
				const edited = await editor({
					message: "Edit summary",
					default: summary,
					waitForUseInput: false,
				});
				if (edited === summary) shouldSave = "yes";
				else if (!edited.length) shouldSave = "redo";
				else {
					shouldSave = "yes";
					summary = edited;
				}
			}
		}
		if (shouldSave === "skip") continue;
		if (!summary) console.warn("Could not generate summary");
		else {
			await fs.mkdir("./data/summaries", { recursive: true });
			await fs.writeFile("./data/summaries/" + program.id + ".summary.txt", summary);
		}
	}

	if (browser) await browser.close();
}

await main();
