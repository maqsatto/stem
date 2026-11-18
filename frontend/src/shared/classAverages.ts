import type { ClassStudentResult } from "@/shared/types";

/** Only students with comparable pre and post results contribute to the chart. */
export function pairedClassAverages(students: ClassStudentResult[]) {
  const paired = students.filter((student) => student.pre_overall !== null && student.post_overall !== null);
  if (!paired.length) return { pre: 0, post: 0, delta: 0 };
  const pre = paired.reduce((sum, student) => sum + (student.pre_overall ?? 0), 0) / paired.length;
  const post = paired.reduce((sum, student) => sum + (student.post_overall ?? 0), 0) / paired.length;
  return { pre, post, delta: post - pre };
}
