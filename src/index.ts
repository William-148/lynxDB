import { Enrollment } from "../tests/types/enrollment-test.type";
import { LocalDatabase } from "./core/data-base";

const db = new LocalDatabase();

const defaultData: Enrollment[] = [
  { year: 2025, semester: 'Fall',   courseId: 101, studentId: 1, grade: 60, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Fall',   courseId: 111, studentId: 1, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Spring', courseId: 102, studentId: 2, grade: 30, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Spring', courseId: 112, studentId: 2, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Summer', courseId: 103, studentId: 3, grade: 87, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Summer', courseId: 113, studentId: 3, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Fall',   courseId: 104, studentId: 4, grade: 61, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Fall',   courseId: 114, studentId: 4, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Spring', courseId: 105, studentId: 5, grade: 75, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Spring', courseId: 115, studentId: 5, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' }
]

const test = async () => {  
  db.createTable<Enrollment>("enrollment", ['year', 'semester', 'courseId', 'studentId',]);
  
  const enrollments = db.getTable<Enrollment>("enrollment");
  enrollments.bulkInsert(defaultData);

  try {
    await enrollments.insert({ year: 2025, semester: 'Fall', studentId: 1, courseId: 102, grade: 0, resultStatus:'pending', gradeStatus: 'pending' });
    // const result = await enrollments.findByPk({ year: 2025, semester: 'Fall', studentId: 1, courseId: 111 });
    // const result = await enrollments.findByPk({ year: 2025, semester: 'Fall', studentId: 1 });
    // const result = await enrollments.findByPk({ year: 2025, semester: 'Fall' });
    // const result = await enrollments.findByPk({ });
    const result = await enrollments.select([], {
      year: { eq: 2025 },
      semester: { eq: 'Spring' },
      gradeStatus: { eq: 'loaded' }

    })
    console.table(result);

  } catch (error) {
    console.error(error)
  }
}
test();