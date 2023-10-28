import * as fs from "node:fs/promises";

const files = await fs.readdir("./transformed/embeddings/courses");
for (const file of files) {
	const fileContents = await fs.readFile(`./transformed/embeddings/courses/${file}`, "utf-8");
	const lines = fileContents.split("\n");
	const embeddings = lines.map((line) => {
		const course = JSON.parse(line);
		if (!course?.metadata?.schoolName) throw new Error("No school name");
		course.namespace = course.metadata.schoolName;
		return JSON.stringify(course);
	});

	await fs.writeFile(`./transformed/embeddings/courses/${file}`, embeddings.join("\n"));
}
