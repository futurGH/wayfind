import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";
import fs from "node:fs/promises";

interface EmbeddingsLine {
	id: string;
	values: Array<number>;
	metadata: Record<string, string | number>;
	namespace: string;
}

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

await fs.mkdir("./transformed/embeddings/courses", { recursive: true });

for (const school of schoolFiles) {
	const embeddings: Array<string> = [];

	const { description: schoolDescription, courses, ...schoolMetadata } = school;
	const schoolEmbeddingValues = (await embeddingsModel.embedDocuments([schoolDescription]))[0];
	const schoolEmbedding: EmbeddingsLine = {
		id: `school-${schoolMetadata.id}`,
		values: schoolEmbeddingValues,
		metadata: { schoolId: schoolMetadata.id, schoolName: schoolMetadata.name },
		namespace: schoolMetadata.name,
	};
	embeddings.push(JSON.stringify(schoolEmbedding));

	for (const course of courses) {
		const { description: courseDescription, ...courseMetadata } = course;
		const courseEmbeddingValues =
			(await embeddingsModel.embedDocuments([courseDescription]))[0];
		const courseCode = courseMetadata.courseCode.slice(0, 5);
		const courseEmbedding: EmbeddingsLine = {
			id: `${schoolMetadata.id}-course-${courseMetadata.courseCode}`,
			values: courseEmbeddingValues,
			metadata: {
				name: courseMetadata.name,
				grade: courseMetadata.grade,
				fullCourseCode: courseMetadata.courseCode,
				courseCode,
				schoolId: schoolMetadata.id,
				schoolName: schoolMetadata.name,
				text: courseDescription,
			},
			namespace: schoolMetadata.name,
		};
		embeddings.push(JSON.stringify(courseEmbedding));
	}

	await fs.writeFile(
		`./transformed/embeddings/courses/${schoolMetadata.id}.embeddings.ndjson`,
		embeddings.join("\n"),
	);
}
