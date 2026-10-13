// src/portal/grades.js — SDCA grade labels (幼稚園 … 十二年級) from birth date / previous grade.
const ZH = ['幼稚園', '一年級', '二年級', '三年級', '四年級', '五年級', '六年級', '七年級', '八年級', '九年級', '十年級', '十一年級', '十二年級'];
const EN = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];

export function gradeLabel(n) {
  if (n === null || n === undefined || n < 0) return '學前 (Preschool)';
  if (n > 12) return '成人 (Adult)';
  return `${ZH[n]}(${EN[n]})`;
}
/** US grade the child enters in the fall of the school year (age on Sept 1 minus 5). */
export function gradeFromBirth(birth, schoolYearStartYear) {
  if (!birth) return null;
  const b = new Date(birth + 'T00:00:00Z'); const ref = new Date(Date.UTC(schoolYearStartYear, 8, 1));
  let age = ref.getUTCFullYear() - b.getUTCFullYear();
  if (ref.getUTCMonth() < b.getUTCMonth() || (ref.getUTCMonth() === b.getUTCMonth() && ref.getUTCDate() < b.getUTCDate())) age -= 1;
  return age - 5;
}
export function ageOn(birth, dateStr) {
  if (!birth) return null;
  const b = new Date(birth + 'T00:00:00Z'); const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}
export const startYear = (label) => Number(String(label || '').slice(0, 4)) || new Date().getUTCFullYear();
