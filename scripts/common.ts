import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage, SystemMessage } from "langchain/schema";
import { TokenTextSplitter } from "langchain/text_splitter";
import puppeteer, { type Browser, type Page } from "puppeteer";

// Not the best prompt but it's token-efficient and it works well enough with human input
export const systemPrompt = ({ program, university }: { program: string; university: string }) =>
	`Your job is to write a brief paragraph summary of the ${program} program at ${university} for a prospective student. \
You will be provided with admission information within <admission> tags. All admission information should be included in \
your summary. You will also be provided with the program's website within <website> tags. You may optionally use the \
website's contents to supplement your summary. Refer to prerequisite courses by both course code and name when possible.`;

export const userMessage = ({ admission, website }: { admission: ProgramJson; website: string }) =>
	`<admission>${
		JSON.stringify(admission).replaceAll(/[{}]/g, "").replaceAll(/[\u00A0\u2007\u202F]/g, " ")
			.trim()
	}</admission>
<website>${website}</website>`;

export const splitter = new TokenTextSplitter({
	encodingName: "cl100k_base",
	chunkSize: 2000,
	chunkOverlap: 0,
});

export let browser: Browser;
let page: Page;

export async function getWebsiteBody(url: string) {
	browser ??= await puppeteer.launch();
	page ??= await browser.newPage();
	const res = await page.goto(url, { waitUntil: "domcontentloaded" }).catch((e) => {
		console.error(e + " at " + url);
		return null;
	});
	if (!res) return null;
	const websiteBody = await page.evaluate(() => {
		const body = document.querySelector("body");
		if (!body) return null;
		return body.innerText.trim();
	});
	if (!websiteBody) return null;

	// Limit to 2k tokens
	const website = (await splitter.createDocuments([websiteBody]))[0].pageContent;
	return website;
}

let openai: ChatOpenAI;

export async function generateSummary(_program: ProgramJson, modelName: string) {
	if (!openai) {
		const openAIApiKey = validateEnv("OPENAI_KEY");
		openai = new ChatOpenAI({ openAIApiKey, modelName });
	}

	let gradeRange: string | undefined;
	({ gradeRange, ..._program } = { ..._program });

	// GPT really likes interpreting "gradeRange: Below 75%" to mean you can't get in with a grade above 75%,
	// so we just remove the gradeRange if it's below 75%
	// And if it's anything else, we make the key very explicit so that it realizes it's a minimum admission grade
	// This is so I never have to manually edit ~300x "This program requires an average below 75%" again
	const program = gradeRange === "Below 75%"
		? _program
		: { ..._program, averageAdmissionGradeRange: gradeRange };

	const websiteContent = await getWebsiteBody(program.programWebsiteUrl);
	if (!websiteContent) return null;

	const prompt = new SystemMessage(
		systemPrompt({ program: program.name, university: program.university }),
	);
	const user = new HumanMessage(userMessage({ admission: program, website: websiteContent }));

	const output = await openai.predictMessages([prompt, user]);
	return output.content;
}

export function removeNonUtf8(str: string) {
	return str.replace(/[–—]/g, "-").replace(/[^\x00-\x7F]/g, "");
}

export function validateEnv(name: string) {
	if (!(name in process.env)) throw new Error(`Environment variable ${name} not set`);
	return process.env[name]!;
}
