import { looseIncludes } from "@wayfind/lib/string";
import * as fs from "node:fs/promises";

type Course = CoursesJson["courses"][number];

const PROGRAMS: Array<
	{ name: string; schools: Array<number>; contains: (course: Course) => boolean }
> = [{
	name: "Advanced Placement (AP)",
	schools: [183, 192],
	contains: (course) => looseIncludes(course.department.name, "ap course"),
}, {
	name: "Arts",
	schools: [182, 195],
	contains: (course) =>
		looseIncludes(course.department.name, "regional arts")
		|| looseIncludes(course.department.discipline.name, "regional arts"),
}, {
	name: "International Baccalaureate (IB)",
	schools: [186, 188, 190, 210],
	contains: (course) =>
		["7", "8", "9"].includes(course.courseCode.charAt(course.courseCode.length - 1))
		|| (course.scope.courseOwnerID === 210
			&& course.courseCode.charAt(course.courseCode.length - 1) === "6")
		|| looseIncludes(course.department.name, "ib diploma program")
		|| looseIncludes(course.department.name, "ib dp")
		|| looseIncludes(course.department.name, "myp")
		|| looseIncludes(course.department.name, "pre-international baccalaureate")
		|| looseIncludes(course.department.name, "pre-ib")
		|| course.department.name.toLowerCase() === "ib",
}, {
	name: "International Business and Technology (IBT)",
	schools: [196, 198],
	contains: (course) =>
		looseIncludes(course.department.name, "ibt") || looseIncludes(course.name, "ibt"),
}, {
	name: "SciTech",
	schools: [184, 203],
	contains: (course) =>
		looseIncludes(course.department.name, "scitech") || looseIncludes(course.name, "scitech"),
}, {
	name: "Strings",
	schools: [183, 203],
	contains: (course) =>
		looseIncludes(course.department.name, "strings") || looseIncludes(course.name, "strings"),
}, {
	name: "Transportation Engineering and Technology",
	schools: [180],
	contains: (course) =>
		looseIncludes(course.department.name, "transportation engineering")
		|| looseIncludes(course.description, "transportation engineering"),
}, {
	name: "French Immersion",
	schools: [179, 181, 208],
	contains: (course: Course) =>
		looseIncludes(course.department.name, "french immersion")
		|| looseIncludes(course.name, "french immersion"),
}];

async function main() {
	const courseListPaths = await fs.readdir("./data/courses");
	const courseLists = await Promise.all(
		courseListPaths.map(async (path) =>
			JSON.parse(
				(await fs.readFile(`./data/courses/${path}`, "utf-8")).toString(),
			) as CoursesJson
		),
	);

	const transformedCourseLists = courseLists.map((school) => {
		const andFormatter = new Intl.ListFormat("en-CA", { style: "long", type: "conjunction" });
		const orFormatter = new Intl.ListFormat("en-CA", { style: "long", type: "disjunction" });

		const courses = school.courses.map((course) => {
			try {
				let description =
					`${course.name} is a grade ${course.grade} course with the course code ${course.courseCode}`;
				if (course.altCourseCode) description += ` or ${course.altCourseCode}`;
				description += ". ";
				description += `It is `;
				if (course.type?.name) {
					description +=
						["a", "e", "i", "o", "u"].includes(course.type.name.charAt(0).toLowerCase())
							? "an "
							: "a ";
					description += `${course.type.name}–level course `;
				}
				description += `in the ${course.department.discipline.name} department. `;
				if (
					// boolean alone doesn't seem to always be enough to be sure
					course.isElearning
					|| school.eLearnCourses.some((c) => c.courseCode === course.courseCode)
				) {
					description += "This course is available as an e-learning course. ";
				}

				PROGRAMS.forEach((program) => {
					if (program.schools.includes(school.id) && program.contains(course)) {
						description += `This course is part of the ${program.name} program. `;
					}
				});

				if (course.prerequisites.length) {
					description += `The prerequisites for this course are ${
						orFormatter.format(course.prerequisites)
					}. `;
				}
				if (course.corequisites.length) {
					description += `The corequisites for this course are ${
						orFormatter.format(course.corequisites)
					}. `;
				}

				if (course.description) {
					description += course.description;
				}
				if (course.guidanceMessage) {
					description += ` — Guidance message: ${course.guidanceMessage}`;
				}

				description = description.replaceAll(/\s*\r\n/g, " ");

				return {
					name: course.name,
					grade: course.grade,
					courseCode: course.courseCode,
					description,
				};
			} catch (e) {
				console.error(`${e} on ${course.name} (${course.scope.courseOwnerID})`);
			}
		});

		let schoolDescription = `\
${school.name} is located in ${school.location.city}, ${school.location.province}. \
It is part of the ${school.location.board} school board.`;
		const schoolPrograms = PROGRAMS.filter((program) => program.schools.includes(school.id));
		if (schoolPrograms.length) {
			schoolDescription += ` The school offers the ${
				andFormatter.format(schoolPrograms.map((p) => p.name))
			} program${schoolPrograms.length > 1 ? "s" : ""}.`;
		}

		return { id: school.id, name: school.name, description: schoolDescription, courses };
	});

	await fs.mkdir("./transformed/schools", { recursive: true });

	await Promise.all(
		transformedCourseLists.map((school) =>
			fs.writeFile(
				`./transformed/schools/${school.id}.school.json`,
				JSON.stringify(school, null, "\t"),
			)
		),
	);
}

await main();
