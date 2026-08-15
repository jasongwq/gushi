# 5 Bug Fixes Design

## Overview

Fix 5 bugs in the 古诗抽查 app: quiz setup config persistence, fill-blank display, empty quiz handling, wrong book unproficient marking, and remove selectTitle quiz type.

## Bug 1: QuizSetupPage Config Persistence

**Problem:** When returning from result page to home and re-entering setup, all config (source, quizTypes, count, grades) is lost.

**Solution:** Extend `UserSettings` to persist quiz config in localStorage.

**Changes:**
- `src/types/index.ts`: Add `source`, `quizTypes`, `selectedGrades` to `UserSettings`
- `src/utils/storage.ts`: Update `getDefaultData()` with new settings defaults
- `src/views/QuizSetupPage.vue`: Read initial values from `learningStore.settings`, call `updateSettings` on each change

## Bug 2: Fill-Blank No Visible Blanks

**Problem:** Fill-blank questions show the full poem text without any blanks, so users can't tell which character to fill in.

**Solution:** In `FillBlankQuiz.vue`, use `question.blankPositions` to replace blanked characters with `____` in the displayed text.

**Changes:**
- `src/components/FillBlankQuiz.vue`: Add a computed `displayPrompt` that processes the poem text, strips punctuation, and replaces characters at `blankPositions` with `____`

**Algorithm:**
1. Join poem text lines
2. Strip punctuation characters (same set used in question generation)
3. Build a mapping from stripped-char index to original position
4. Replace chars at `blankPositions` indices with `____`
5. Re-insert into original text structure for display

## Bug 3: Empty Quiz Shows "Complete"

**Problem:** When no poems match the selected source (e.g., empty wrong book), clicking "开始抽查" navigates to quiz-play which immediately shows "答题完成！".

**Solution:** Prevent starting a quiz with 0 questions, and show a message instead.

**Changes:**
- `src/stores/quiz.ts`: `startQuiz` returns `boolean` indicating success; if `questions.length === 0`, don't set session, return false
- `src/views/QuizSetupPage.vue`: If `startQuiz` returns false, show an inline error message "没有符合条件的题目，请调整设置"
- `src/views/QuizPlayPage.vue`: Add a guard for `isFinished && totalQuestions === 0` showing "没有题目" with a back button

## Bug 4: Wrong Book Can't Mark Unproficient

**Problem:** `toggleUnproficient` only updates `LearningRecord.unproficient`, but the `WrongBookPage` reads `WrongEntry.unproficient` for display. The two are out of sync.

**Root cause:** In `learning.ts`, `toggleUnproficient` updates the record but never touches `wrongBook` entries. The `WrongEntry.unproficient` field is only set to `false` when a new wrong entry is created (line 51).

**Solution:** In `toggleUnproficient`, also update all `wrongBook` entries for the same `poemId`.

**Changes:**
- `src/stores/learning.ts`: In `toggleUnproficient`, after updating the record, also update `data.value.wrongBook` entries matching `poemId` to set their `unproficient` field to the same value

## Bug 5: Remove SelectTitle Quiz Type

**Problem:** User wants to remove the "选标题/作者/朝代" quiz type entirely.

**Changes:**
- `src/types/index.ts`: Remove `'selectTitle'` from `QuizType`
- `src/stores/quiz.ts`: Remove `selectTitle` case from `generateQuestion`, remove `generateSelectOptions` import, change `recite` fallback to `nextLine`
- `src/utils/distractor.ts`: Remove `generateSelectOptions` function
- `src/components/SelectTitleQuiz.vue`: Delete file
- `src/views/QuizSetupPage.vue`: Remove `selectTitle` from `quizTypeOptions`
- `src/views/QuizPlayPage.vue`: Remove `SelectTitleQuiz` component import and usage
- `src/views/WrongBookPage.vue`: Remove `selectTitle` from `quizTypeLabels`
- `src/types/index.ts`: Update `WrongEntry.quizType` to exclude `selectTitle`
