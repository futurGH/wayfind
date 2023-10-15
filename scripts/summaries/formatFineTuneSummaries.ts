import fs from "node:fs/promises";
import { browser } from "./common";
import { getWebsiteBody, userMessage } from "./common";

const summaryFiles = await fs.readdir("./data/summaries");
const programs = await Promise.all(summaryFiles.map(async (file) => {
	const summary = await fs.readFile(`./data/summaries/${file}`, "utf-8");

	const programId = file.split(".")[0];
	const programInfo = JSON.parse(
		(await fs.readFile(`./data/programs/${programId}.program.json`, "utf-8")).toString(),
	) as ProgramJson;

	return { summary, admission: programInfo };
}));

const systemMessage = `Your job is to write a brief paragraph summary of a university program \
for a prospective student. You will be provided with the program's admission details within <admission> tags. All admission \
information should be included in your summary. You will also be provided with the program's website within <website> tags. \
You may optionally use the website's contents to supplement your summary.`;

async function main() {
	let trainingData = "";
	for (const program of programs) {
		console.log(program.admission.name);
		const { summary, admission } = program;

		const website = await getWebsiteBody(admission.programWebsiteUrl);
		if (!website) {
			console.log("Unable to fetch website body");
			continue;
		}

		const line = {
			messages: [{ role: "system", content: systemMessage }, {
				role: "user",
				content: userMessage({ admission, website }),
			}, { role: "assistant", content: summary }],
		};
		trainingData += JSON.stringify(line) + "\n";
	}

	await browser.close();

	await fs.mkdir("./transformed/summaries", { recursive: true });
	await fs.writeFile("./transformed/summary-finetune.jsonl", trainingData);
}

main().catch(console.error);
