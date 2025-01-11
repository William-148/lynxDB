export type Enrollment = {
  year: number;
  semester: 'Spring' | 'Summer' | 'Fall';
  courseId: number; 
  studentId: number; 
  grade: number;
  resultStatus: 'pending' | 'approved' | 'reproved';
  gradeStatus: 'pending' | 'loaded';
}

export function getResultStatus(grade: number): 'approved' | 'reproved' {
  return (grade >= 61) ? 'approved' : 'reproved';
}