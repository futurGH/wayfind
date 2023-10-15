import { configDotenv } from "dotenv";
import fs from "node:fs/promises";
import { fetch } from "undici";
import { validateEnv } from "../summaries/common";

configDotenv();

const myBlueprintApiKey = validateEnv("MYBLUEPRINT_API_KEY");

const allSchools = await fetch("https://api.myblueprint.ca/v1.0/School/NonElem", {
	headers: { Authorization: `Bearer ${myBlueprintApiKey}` },
}).then((r) => r.json());

if (!Array.isArray(allSchools)) throw new Error("Expected school array");

const relevantSchools = allSchools.filter((s) =>
	s.schoolId && s.schoolId > 0 && s.schoolId < 1000 && s.activKey && !s.activKey.includes("demo")
);

for (const school of relevantSchools) {
	const courses = await fetch(
		`https://api.myblueprint.ca/v1.0/Course/School/${school.schoolId}`,
		{ headers: { Authorization: `Bearer ${myBlueprintApiKey}` } },
	).then((r) => r.json());

	if (!courses) throw new Error("Could not fetch course list");

	const schoolJson = {
		id: school.schoolId,
		name: school.name,
		location: { province: school.province.name, board: school.schoolBoard.name },
		...courses,
	};

	await fs.writeFile(
		`./data/courses/${school.schoolId}.courses.json`,
		JSON.stringify(schoolJson, null, "\t"),
	);
}
