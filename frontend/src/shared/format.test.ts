import { describe, expect, it } from "vitest";

import {
  contentPath,
  formatBytes,
  formatDelta,
  formatPercent,
  highestRolePath,
  lessonPath,
  statusLabels,
  taskTypeLabels,
} from "@/shared/format";

describe("format helpers", () => {
  it("formats bytes for empty, KB and MB values", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(512)).toBe("512 Б");
    expect(formatBytes(2048)).toBe("2.0 КБ");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 МБ");
  });

  it("formats percentages and deltas", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(42.25)).toBe("42.3%");
    expect(formatDelta(undefined)).toBe("—");
    expect(formatDelta(0)).toBe("0.0 п.п.");
    expect(formatDelta(7.5)).toBe("+7.5 п.п.");
    expect(formatDelta(-3.2)).toBe("-3.2 п.п.");
  });

  it("keeps Kazakh labels for statuses and task types", () => {
    expect(statusLabels.published).toBe("Жарияланған");
    expect(statusLabels.returned).toBe("Қайта өңдеуге");
    expect(taskTypeLabels.multiple_choice).toBe("Бірнеше дұрыс жауап");
  });

  it("routes content by role", () => {
    expect(lessonPath("student", "abc")).toBe("/student/lessons/abc");
    expect(lessonPath("teacher", "abc")).toBe("/teacher/lessons/abc");
    expect(contentPath("admin", "assessment", "xyz")).toBe(
      "/admin/assessments?edit=xyz",
    );
    expect(contentPath("admin", "unknown", "xyz")).toBe("/admin/content?edit=xyz");
    expect(contentPath("student", "project", "p1")).toBe("/student/projects/p1");
    expect(highestRolePath("admin")).toBe("/admin/content");
    expect(highestRolePath("teacher")).toBe("/teacher/dashboard");
    expect(highestRolePath("student")).toBe("/student/dashboard");
  });
});
