import { configDotenv } from "dotenv";
import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";
import fs from "node:fs/promises";
import { removeNonUtf8 } from "../common";
import { Courses as XataCourse, getXataClient } from "../xata";

configDotenv();

const schools = await fs.readdir("./transformed/schools");
const schoolFiles = await Promise.all(
	schools.map((school) =>
		fs.readFile(`./transformed/schools/${school}`, "utf-8").then((m) =>
			JSON.parse(m) as SchoolJson
		)
	),
);

const embeddingsModel = new HuggingFaceTransformersEmbeddings({
	modelName: "Xenova/bge-base-en-v1.5",
});

const xata = getXataClient();

for (const school of schoolFiles) {
	const embeddings: Array<XataCourse> = [];

	const { courses, ...schoolMetadata } = school;

	for (const course of courses) {
		const { description: courseDescription, courseCode: fullCourseCode, ...courseMetadata } =
			course;
		const courseEmbeddingValues =
			(await embeddingsModel.embedDocuments([courseDescription]))[0];
		const courseCode = fullCourseCode.slice(0, 5);
		const id = `${schoolMetadata.id}-course-${fullCourseCode}`.replace(
			/[^a-zA-Z0-9\-_:~]/g,
			"",
		);
		const courseRecord = {
			id,
			content: removeNonUtf8(courseDescription),
			embedding: courseEmbeddingValues,
			name: courseMetadata.name,
			grade: courseMetadata.grade,
			courseCode,
			fullCourseCode,
			schoolName: schoolMetadata.name,
		};
		embeddings.push(courseRecord);
	}

	await xata.db.courses.createOrUpdate(embeddings).catch((e) => {
		console.error(school.id, school.name, e);
	});
}
