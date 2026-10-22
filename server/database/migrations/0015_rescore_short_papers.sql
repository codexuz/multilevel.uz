-- Listening and Reading attempts on papers shorter than 35 questions (a part practised on its own)
-- were scored by their share of right answers scaled up to 35. Re-read them from the official
-- tables by the right answers themselves, as server/utils/score.ts now does.
UPDATE "attempts" SET "score" = (CASE WHEN "skill" = 'LISTENING'
    THEN (ARRAY[0,23,26,28,30,33,34,36,38,39,41,42,44,45,47,48,50,51,53,54,55,57,58,60,61,63,65,66,68,70,72,73,74,75,75,75])[LEAST(GREATEST("correct", 0), 35) + 1]
    ELSE (ARRAY[0,20,24,27,29,32,34,36,38,39,41,42,44,45,46,48,49,51,52,54,55,57,58,60,61,63,65,66,68,70,71,73,74,75,75,75])[LEAST(GREATEST("correct", 0), 35) + 1] END)
WHERE "skill" IN ('LISTENING', 'READING') AND "correct" IS NOT NULL AND "total" IS NOT NULL AND "total" <> 35;
--> statement-breakpoint
UPDATE "attempts" SET "cefr_level" = CASE WHEN "score" >= 65 THEN 'C1' WHEN "score" >= 51 THEN 'B2' WHEN "score" >= 38 THEN 'B1' ELSE 'A2' END
WHERE "skill" IN ('LISTENING', 'READING') AND "correct" IS NOT NULL AND "total" IS NOT NULL AND "total" <> 35;
