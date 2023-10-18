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


- ### Fine-Tuning
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

## note on fine-tuning

GPT-4 would be too expensive for generating summaries (estimate $90 at $0.02/1k tokens). GPT-3.5 does not do well with a one-shot summary prompt where it needs to draw data from both the JSON and the website. Asking it to e.g. first generate a summary of each then combine them is:

- expensive (may change with stateful API)
- unreliable (it still didn't correctly format the summaries >50% of the time, so extraction would end up being a manual process)

As a result, fine-tuned GPT-3.5 was the most viable option for generating summaries of all ~1.4k university programs in Ontario to provide to the application as embeddings. 

The fine-tuning itself cost just over $3 at $0.008 per 1k tokens, and generating all the summaries was about $30 ($0.012/1k input, $0.016/1k output tokens).
