import { Table } from "./core/table";
import { User } from "../tests/types/user-test.type";
import { thirtyItemsUserList } from "../tests/data/data-test";
import { DuplicatePrimaryKeyValueError } from "./core/errors/table.error";
import { Enrollment } from "../tests/types/enrollment-test.type";


const defaultData: Enrollment[] = [
  { year: 2025, semester: 'Fall',   studentId: 1, courseId: 101, grade: 60, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Fall',   studentId: 1, courseId: 111, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Spring', studentId: 2, courseId: 102, grade: 30, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Spring', studentId: 2, courseId: 112, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Summer', studentId: 3, courseId: 103, grade: 87, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Summer', studentId: 3, courseId: 113, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Fall',   studentId: 4, courseId: 104, grade: 61, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Fall',   studentId: 4, courseId: 114, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Spring', studentId: 5, courseId: 105, grade: 75, resultStatus: 'pending', gradeStatus: 'loaded'  },
  { year: 2025, semester: 'Spring', studentId: 5, courseId: 115, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' }
]

const test = async () => {
  const genericTable = new Table<Enrollment>('user', ['year', 'semester', 'studentId', 'courseId']);
  genericTable.bulkInsert(defaultData);
  try {
    await genericTable.insert({ year: 2025, semester: 'Fall', studentId: 1, courseId: 102, grade: 0, resultStatus:'pending', gradeStatus: 'pending' });
    // const result = await genericTable.findByPk({ year: 2025, semester: 'Fall', studentId: 1, courseId: 111 });
    const result = await genericTable.findByPk({ year: 2025, semester: 'Fall', studentId: 1 });
    // const result = await genericTable.findByPk({ year: 2025, semester: 'Fall' });
    // const result = await genericTable.findByPk({ });
    console.table(result);

  } catch (error) {
    console.error(error)
  }
}
test();