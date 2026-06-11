import { describe, expect, it } from "vitest";
import { exerciseLibrary } from "../../src/core/exercise-library";
import { trainingTemplates } from "../../src/core/training-templates";

describe("training templates", () => {
  it("uses only exercises present in the library", () => {
    const libraryIds = new Set(exerciseLibrary.map((exercise) => exercise.id));
    const missing = trainingTemplates.flatMap((template) =>
      template.blocks
        .flatMap((block) => block.exerciseIds)
        .filter((id) => !libraryIds.has(id))
    );

    expect(missing).toEqual([]);
  });

  it("includes the four v1 templates from the spec", () => {
    expect(trainingTemplates.map((template) => template.id)).toEqual([
      "upper-back-core",
      "glute-pelvis",
      "full-body-light",
      "recovery"
    ]);
  });
});
