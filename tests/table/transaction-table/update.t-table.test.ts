import { DuplicatePrimaryKeyValueError } from "../../../src/core/errors/table.error";
import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { Enrollment, getResultStatus } from "../../types/enrollment-test.type";
import { User } from "../../types/user-test.type";


describe("Transaction Table Update", () => {
  const TestData: User[] = [
    { id: 1, fullName: "John", gender: "Male", age: 20, email: "jhon@some.com", username: "jhon", password: "123" },
    { id: 2, fullName: "Jane", gender: "Female", age: 25, email: "jane@some.com", username: "jane", password: "456" },
    { id: 3, fullName: "Alice", gender: "Female", age: 30, email: "alice@some.com", username: "alice", password: "789" },
    { id: 4, fullName: "Bob", gender: "Male", age: 35, email: "bob@some.com", username: "bob", password: "101" },
    { id: 5, fullName: "Charlie", gender: "Male", age: 40, email: "charlie@some.com", username: "charlie", password: "112" }
  ];

  let table: Table<User>;
  let transactionTable: TransactionTable<User>;

  beforeEach(() => {
    table = new Table<User>({ name: "users", primaryKey: ["id"] });
    table.bulkInsert(TestData);

    transactionTable = new TransactionTable<User>(
      generateId(),
      table
    );
  });

  it("should update a record", async () => {
    const RecordTest = TestData[2];
    const updatedFields: Partial<User> = { fullName: "Alice Wonderland", username: "alice_wonderland", password: "lss$$asf&&a11_Alice" };
    const affectedRows = await transactionTable.update(
      updatedFields, 
      { id: { eq: RecordTest.id } }
    );

    const updatedRecord = await transactionTable.findByPk({ id: RecordTest.id });

    expect(affectedRows).toBe(1);
    expect(updatedRecord).toEqual({ ...RecordTest, ...updatedFields });
  });

  it("should affect no rows when do not have any fields to update", async () => {
    const affectedRows = await transactionTable.update({}, {});
    expect(affectedRows).toBe(0);
  });

  it("should update all records", async () => {
    const affectedRows = await transactionTable.update({ age: 45, password: "new_password" }, {});

    expect(affectedRows).toBe(TestData.length);
    const updatedRecords = await transactionTable.select([], {});
    expect(transactionTable.size()).toBe(TestData.length);
    expect(transactionTable.sizeMap).toBe(TestData.length);
    updatedRecords.forEach(record => {
      expect(record.age).toBe(45);
      expect(record.password).toBe("new_password");
    });
  });


  it("should update the PK of a record and insert a new record with the old PK", async () => {
    const InitialRegisteredPk = 4;
    const LoopCount = 5;
    const InitialUnregisteredPk = 1000;
    const userToInsert: User = { id: InitialRegisteredPk, fullName: "Arnold", gender: "Male", age: 42, email: "arnold@some.com", username: "arnold", password: "456" };

    let currentUnregisteredPK = InitialUnregisteredPk;
    for (let i = 1; i <= LoopCount; i++) {
      currentUnregisteredPK++;
      // Update a field different from the PK
      const firstUpdateAffectedRows = await transactionTable.update(
        { fullName: `Bob Marley ${i}`}, 
        { id: { eq: InitialRegisteredPk } }
      );
      
      // Update the PK
      const updatedPkAffectedRows = await transactionTable.update(
        { id: currentUnregisteredPK },
        { id: { eq: InitialRegisteredPk } }
      );

      // Find the record with the new PK
      const updatedPkRecord = await transactionTable.findByPk({ id: currentUnregisteredPK });
      
      // Find the record with the old PK
      const oldPkRecord = await transactionTable.findByPk({ id: InitialRegisteredPk });
      expect(firstUpdateAffectedRows).toBe(1);
      expect(updatedPkAffectedRows).toBe(1);
      expect(updatedPkRecord).not.toBeNull();
      expect(oldPkRecord).toBeNull();
      // Insert a new record with the old PK
      await expect(transactionTable.insert(userToInsert)).resolves.not.toThrow();
      await expect(transactionTable.insert(userToInsert)).rejects.toThrow(DuplicatePrimaryKeyValueError);
      // Find the recent inserted record with the old PK
      await expect(transactionTable.findByPk({ id: InitialRegisteredPk })).not.toBeNull();
    }
    expect(transactionTable.size()).toBe(TestData.length + LoopCount);
  });

});

describe('Transaction Table with composite PK - update() - should...', () => {

  const enrollmentData: Enrollment[] = [
    { year: 2025, semester: 'Fall',   courseId: 101, studentId: 1, grade: 60, resultStatus: 'pending', gradeStatus: 'loaded'  }, 
    { year: 2025, semester: 'Fall',   courseId: 111, studentId: 1, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
    { year: 2025, semester: 'Spring', courseId: 102, studentId: 2, grade: 30, resultStatus: 'pending', gradeStatus: 'loaded'  },
    { year: 2025, semester: 'Spring', courseId: 112, studentId: 2, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
    { year: 2025, semester: 'Summer', courseId: 103, studentId: 3, grade: 87, resultStatus: 'pending', gradeStatus: 'loaded'  },
    { year: 2025, semester: 'Summer', courseId: 113, studentId: 3, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
    { year: 2025, semester: 'Fall',   courseId: 104, studentId: 4, grade: 61, resultStatus: 'pending', gradeStatus: 'loaded'  },
    { year: 2025, semester: 'Fall',   courseId: 114, studentId: 4, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' },
    { year: 2025, semester: 'Spring', courseId: 105, studentId: 5, grade: 59, resultStatus: 'pending', gradeStatus: 'loaded'  },
    { year: 2025, semester: 'Spring', courseId: 115, studentId: 5, grade: 0,  resultStatus: 'pending', gradeStatus: 'pending' }
  ];

  let table: Table<Enrollment>;
  let enrollmentTable: TransactionTable<Enrollment>;

  beforeEach(() => {
    table = new Table<Enrollment>({ name: 'enrollments', primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
    table.bulkInsert(enrollmentData);

    enrollmentTable = new TransactionTable<Enrollment>(
      generateId(),
      table
    );
  });

  it('update a single record based on a specific condition', async () => {
    const ItemToTest = enrollmentData[5];
    const ObtainedGrade = 99;
    const UpdatedFields: Partial<Enrollment> = { grade: ObtainedGrade, gradeStatus: 'loaded', resultStatus: getResultStatus(ObtainedGrade) };

    const affectedRows = await enrollmentTable.update(UpdatedFields, { 
      year: { eq: ItemToTest.year },
      semester: { eq: ItemToTest.semester },
      courseId: { eq: ItemToTest.courseId },
      studentId: { eq: ItemToTest.studentId },
      gradeStatus: { eq: 'pending' },
      resultStatus: { eq: 'pending' }
    });

    expect(affectedRows).toBe(1);

    const updatedRecord = await enrollmentTable.findByPk({ 
      year: ItemToTest.year, 
      semester: ItemToTest.semester, 
      courseId: ItemToTest.courseId,
      studentId: ItemToTest.studentId
    });
    expect(updatedRecord).toEqual({ ...ItemToTest, ...UpdatedFields });
    expect(enrollmentTable.size()).toBe(enrollmentData.length);
    expect(enrollmentTable.sizeMap).toBe(enrollmentData.length);
  });

  it('update multiple records matching a condition', async () => {
    const MinimunGradeToPass = 61;
    const YearToTest = 2025;
    const ListApproved: Partial<Enrollment>[] = enrollmentData.filter(item => (
      item.year === YearToTest
      && item.grade >= MinimunGradeToPass 
      && item.gradeStatus === 'loaded' 
      && item.resultStatus === 'pending'
    ));
    const listReproved: Partial<Enrollment>[] = enrollmentData.filter(item => (
      item.grade < MinimunGradeToPass 
      && item.gradeStatus === 'loaded' 
      && item.resultStatus === 'pending'
    ));

    const countApproved = await enrollmentTable.update({ resultStatus: 'approved' }, { 
      year: { eq: YearToTest },
      grade: { gte: MinimunGradeToPass },
      gradeStatus: { eq: 'loaded' },
      resultStatus: { eq: 'pending' }
    });
    const countReproved = await enrollmentTable.update({ resultStatus: 'reproved' }, { 
      year: { eq: YearToTest },
      grade: { lt: MinimunGradeToPass },
      gradeStatus: { eq: 'loaded' },
      resultStatus: { eq: 'pending' }
    });

    expect(countApproved).toBe(ListApproved.length);
    expect(countReproved).toBe(listReproved.length);

    for(let item of ListApproved) {
      const updatedRecord = await enrollmentTable.findByPk({ 
        year: item.year, 
        semester: item.semester, 
        courseId: item.courseId,
        studentId: item.studentId
      });
      expect(updatedRecord).toEqual({ ...item, resultStatus: 'approved' });
    }

    for(let item of listReproved) {
      const updatedRecord = await enrollmentTable.findByPk({ 
        year: item.year, 
        semester: item.semester, 
        courseId: item.courseId,
        studentId: item.studentId
      });
      expect(updatedRecord).toEqual({ ...item, resultStatus: 'reproved' });
    }
  });

  it('update a sigle record where field is part of the composite PK', async () => {
    const ItemToTest = enrollmentData[1];
    const UpdateCourseId: Partial<Enrollment> = { courseId: 115 };
    const affectedRows = await enrollmentTable.update(UpdateCourseId, {
      year: { eq: ItemToTest.year },
      courseId: { eq: ItemToTest.courseId },
      studentId: { eq: ItemToTest.studentId }
    });

    expect(affectedRows).toBe(1);

    // Check if the record with the new courseId exists
    const updatedRecord = await enrollmentTable.findByPk({ 
      year: ItemToTest.year, 
      semester: ItemToTest.semester, 
      courseId: UpdateCourseId.courseId, // Updated field
      studentId: ItemToTest.studentId
    });
    expect(updatedRecord).toEqual({ ...ItemToTest, ...UpdateCourseId });

    // Check if the record with the old courseId no longer exists
    const shouldNotExistRecord = await enrollmentTable.findByPk({ 
      year: ItemToTest.year, 
      semester: ItemToTest.semester, 
      courseId: ItemToTest.courseId, // Old field
      studentId: ItemToTest.studentId
    });
    expect(shouldNotExistRecord).toBeNull();
  });

  it('update multiple record where field is part of the composite PK', async () => {
    const YearToTest = 2025;
    const SemesterToTest = 'Fall';
    const SemesterToUpdate = 'Summer';
    const ItemsShoudNotExistAfterUpdate = enrollmentData.filter(item => (
      item.year === YearToTest && item.semester === SemesterToTest
    ));

    const UpdateSemester: Partial<Enrollment> = { semester: SemesterToUpdate };
    const affectedRows = await enrollmentTable.update(UpdateSemester, {
      year: { eq: YearToTest },
      semester: { eq: SemesterToTest }
    });

    expect(affectedRows).toBe(4);

    // Check if the records with the new semester exist
    const updatedRecord = await enrollmentTable.select([], {
      year: { eq: YearToTest },
      semester: { eq: SemesterToUpdate }
    });
    expect(updatedRecord).toHaveLength(6);
    updatedRecord.forEach(item => {
      expect(item.year).toBe(YearToTest);
      expect(item.semester).toBe(SemesterToUpdate);
    });

    // Check if the records with the old semester no longer exist
    for (let item of ItemsShoudNotExistAfterUpdate){
      const record = await enrollmentTable.findByPk({ 
        year: item.year, 
        semester: item.semester, 
        courseId: item.courseId,
        studentId: item.studentId
      });
      expect(record).toBeNull();
    }
  });

  it('update a record with a complete composite PK', async () => {
    const ItemToTest = enrollmentData[6];
    const UpdatedPK: Partial<Enrollment> = { year: 2026, semester: 'Summer', courseId: 103, studentId: 8 };

    const affectedRows = await enrollmentTable.update(UpdatedPK, { 
      year: { eq: ItemToTest.year },
      semester: { eq: ItemToTest.semester },
      courseId: { eq: ItemToTest.courseId },
      studentId: { eq: ItemToTest.studentId }
    });

    expect(affectedRows).toBe(1);

    // Check if the record with the new PK exists
    const updatedRecord = await enrollmentTable.findByPk({ 
      year: UpdatedPK.year, 
      semester: UpdatedPK.semester, 
      courseId: UpdatedPK.courseId,
      studentId: UpdatedPK.studentId
    });
    expect(updatedRecord).toEqual({ ...ItemToTest, ...UpdatedPK });

    // Check if the record with the old PK no longer exists
    const shouldNotExist = await enrollmentTable.findByPk({ 
      year: ItemToTest.year, 
      semester: ItemToTest.semester, 
      courseId: ItemToTest.courseId,
      studentId: ItemToTest.studentId
    });
    expect(shouldNotExist).toBeNull();

  });

  it('throw an error when updating the full composite PK of a record with an existing PK', async () => {
    const ItemToTestA = enrollmentData[4];
    const ItemToTestB = enrollmentData[7];
    const ItemPkToTest: Partial<Enrollment> = {
      year: ItemToTestA.year,
      semester: ItemToTestA.semester,
      courseId: ItemToTestA.courseId,
      studentId: ItemToTestA.studentId
    };
    const pkAlreadyRegistered: Partial<Enrollment> = {
      year: ItemToTestB.year,
      semester: ItemToTestB.semester,
      courseId: ItemToTestB.courseId,
      studentId: ItemToTestB.studentId
    };

    const errorUpdate = async () => {
      await enrollmentTable.update(pkAlreadyRegistered, { 
        year: { eq: ItemPkToTest.year },
        semester: { eq: ItemPkToTest.semester },
        courseId: { eq: ItemPkToTest.courseId },
        studentId: { eq: ItemPkToTest.studentId }
      });
    }

    await expect(errorUpdate)
      .rejects
      .toThrow(DuplicatePrimaryKeyValueError);

  });

  it('throw an error when a part of the composite PK of a record is updated resulting in an existing PK', async () => {
    /**
     * ItemToTestA and ItemToTestB have the same year, semester and studentId
     * only the courseId is different, when updating the courseId of 
     * ItemToTestA to the courseId of ItemToTestB or vice versa, the PK will 
     * be duplicated
     */
    const ItemToTestA = enrollmentData[6];
    const ItemToTestB = enrollmentData[7];

    const errorUpdate = async () => {
      await enrollmentTable.update({ courseId: ItemToTestB.courseId }, { 
        year: { eq: ItemToTestA.year },
        semester: { eq: ItemToTestA.semester },
        courseId: { eq: ItemToTestA.courseId },
        studentId: { eq: ItemToTestA.studentId }
      });
    }

    await expect(errorUpdate)
      .rejects
      .toThrow(DuplicatePrimaryKeyValueError);

  });

  it('throw an error when updating the full PK of multiple records with an unregistered PK', async () => {
    const newPk: Partial<Enrollment> = { year: 2026, semester: 'Fall', courseId: 201, studentId: 10 };

    const errorUpdate = async () => {
      await enrollmentTable.update(newPk, {});
    }

    await expect(errorUpdate)
      .rejects
      .toThrow(DuplicatePrimaryKeyValueError);

    const record = await enrollmentTable.select([], {
      year: { eq: newPk.year },
      semester: { eq: newPk.semester },
      courseId: { eq: newPk.courseId },
      studentId: { eq: newPk.studentId }
    });
    expect(record).toHaveLength(1);

  });

  it('throw an error when updating a part of the PK of multiple records with an unregistered PK', async () => {
    const ItemTest = enrollmentData[2];
    const partialPK: Partial<Enrollment> = { courseId: 500 };

    const errorUpdate = async () => {
      await enrollmentTable.update({ courseId: 500 }, { studentId: { eq: ItemTest.studentId } });
    }

    await expect(errorUpdate)
      .rejects
      .toThrow(DuplicatePrimaryKeyValueError)

    const expectedItem = { ...ItemTest, ...partialPK };
    const record = await enrollmentTable.select([], {
      year: { eq: expectedItem.year },
      semester: { eq: expectedItem.semester },
      courseId: { eq: expectedItem.courseId },
      studentId: { eq: expectedItem.studentId }
    });
    expect(record).toHaveLength(1);
    expect(expectedItem).toEqual(record[0]);
  });
  
});