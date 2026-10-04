import {
  levelFromText,
  runFromText,
  TICKS_PER_SECOND,
  verify,
} from "@zeybek/supaplex";
import { levels } from "@zeybek/supaplex/levels";

/** Twenty minutes. */
const MAX_TICKS = TICKS_PER_SECOND * 60 * 20;

/**
 * Replies `{ won, ticks, seconds }` to `POST { level, run }`, where `level` is
 * an original level's number or link text and `run` comes from `runToText`.
 */
export async function handle(request, engine) {
  if (request.method !== "POST")
    return Response.json({ error: "POST a level and a run" }, { status: 405 });
  const body = await request.json().catch(() => null);
  const level =
    typeof body?.level === "number"
      ? levels()[body.level - 1]?.bytes
      : await levelFromText(body?.level);
  const run = runFromText(body?.run);
  if (!level || !run)
    return Response.json({ error: "No level, or no run" }, { status: 400 });
  if (run.ticks > MAX_TICKS)
    return Response.json({ error: "The run is too long" }, { status: 413 });
  const { won, ticks } = verify(engine, level, run);
  return Response.json({ won, ticks, seconds: ticks / TICKS_PER_SECOND });
}
