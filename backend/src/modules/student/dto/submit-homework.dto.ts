// Sprint H1.5: POST /student/homework/:homeworkId/submit needs no request
// body today -- which homework is being submitted comes from the URL
// param, who's submitting comes from the authenticated caller's token,
// and HomeworkSubmission has no note/file/comment column yet (see that
// entity's own header comment: attachments and grading are explicitly
// deferred to a later sprint, not part of this one).
//
// An empty validated DTO is used here instead of typing the body as
// `any`/`object` so this route still runs through the app's global
// ValidationPipe (whitelist + forbidNonWhitelisted, see main.ts) -- a
// caller who sends stray body fields gets a 400 rejecting them, rather
// than those fields being silently accepted and ignored. No properties
// are declared because there is nothing to validate yet; if a future
// sprint adds an optional field (e.g. a student note), it's a one-line
// addition to this file, not a new one.
export class SubmitHomeworkDto {}
