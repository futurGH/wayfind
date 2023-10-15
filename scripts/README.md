# Embeddings Setup Workflow

## Courses

- `courses/fetchCourseLists.ts` to fetch course lists from MyBlueprint
  - requires `process.env.MYBLUEPRINT_API_KEY`
  - writes to `data/courses/*.courses.json`
- `courses/transformCourses.ts` to extract relevant course data and write summaries
  - writes to `transformed/schools/*.school.json`
- `embeddings/generateCourseEmbeddings.ts` to generate course embeddings
  - writes to `transformed/embeddings/courses/*.embeddings.ndjson`

## University Programs

- `summaries/fetchProgramInfo.ts` to fetch program info from ontariouniversitiesinfo.ca
  - writes to `data/programs/*.program.json`


- ### Fine Tuning
  - `summaries/generateFineTuneSummaries.ts` to generate GPT-4 summaries for randomly selected programs in order to fine-tune gpt-3.5-turbo
    - requires `process.env.OPENAI_KEY`
    - writes to `data/summaries/*.summary.txt`
  - `summaries/formatFineTuneSummaries.ts` to combine summaries with ontariounversitiesinfo.ca data & format as a conversation for fine-tuning
	- writes to `transformed/summary-finetune.jsonl`
  - `summaries/createFineTuneFromSummaries.ts` to run fine-tune job
    - requires `process.env.OPENAI_KEY`
  - `summaries/generateAllSummaries.ts` to generate all summaries using fine-tuned model
	- requires `process.env.OPENAI_KEY`, `process.env.SUMMARY_MODEL_ID`
	- writes to `transformed/summaries/*.summary.txt`


- `embeddings/generateProgramEmbeddings.ts` to generate university program embeddings
  - writes to `transformed/embeddings/programs/programs.embeddings.ndjson`
