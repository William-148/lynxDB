import { DuplicatePrimaryKeyValueError } from "../../../src/core/errors/table.error";
import { Table } from "../../../src/core/table";
import { Enrollment, getResultStatus } from "../../types/enrollment-test.type";

type Entity = {
  id: number;
  name: string;
  value: number;
  status: string;
}

const EntityData: Entity[] = [
  { id: 1, name: 'Alpha', value: 10, status: 'active' },
  { id: 2, name: 'Beta', value: 20, status: 'inactive' },
  { id: 3, name: 'Gamma', value: 30, status: 'active' },
  { id: 4, name: 'Delta', value: 40, status: 'inactive' }
];

/**
 * Common tests for update() method using a single PK
 * 
 * @param description The description of the test
 * @param createInstance Function that return a new instance of Table< any > with "id" as PK.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => { 
 *  const table = new Table<any>({ primaryKey: ['id'] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * ```
 */
export function updateTestWithSinglePK(description: string, createInstance: (testData: Entity[]) => Promise<Table<any>>) {
  describe(description, () => {
    let entityTable: Table<Entity>;

    beforeEach(async () => {
      entityTable = await createInstance(EntityData);
    });

    it('update a single record based on a specific condition', async () => {
      const affectedRows = await entityTable.update({ status: 'archived' }, { id: { eq: 1 } });
      expect(affectedRows).toBe(1);

      const updatedRecord = await entityTable.findByPk({ id: 1 });
      expect(updatedRecord?.status).toBe('archived');
    });

    it('update multiple records matching a condition', async () => {
      const affectedRows = await entityTable.update({ status: 'archived' }, { status: { eq: 'inactive' } });
      expect(affectedRows).toBe(2);
      
      const updatedRecords = await entityTable.select([], { status: { eq: 'archived' } });
      expect(updatedRecords).toHaveLength(2);
      expect(updatedRecords.map(record => record.name)).toEqual(['Beta', 'Delta']);
    });

    it('update records with numeric fields', async () => {
      const affectedRows = await entityTable.update({ value: 99 }, { value: { lt: 30 } });
      expect(affectedRows).toBe(2);

      const updatedRecords = await entityTable.select([], { value: { eq: 99 } });
      expect(updatedRecords).toHaveLength(2);
      expect(updatedRecords.map(record => record.name)).toEqual(['Alpha', 'Beta']);
    });

    it('not update any record if no conditions match', async () => {
      const affectedRows = await entityTable.update({ status: 'archived' }, { id: { eq: 999 } });
      expect(affectedRows).toBe(0);

      const records = await entityTable.select([], { status: { eq: 'archived' } });
      expect(records).toHaveLength(0);
    });

    it('update all records when no conditions are specified', async () => {
      const affectedRows = await entityTable.update({ value: 45, status: "archived_platform" }, {});

      expect(affectedRows).toBe(EntityData.length);
      const updatedRecords = await entityTable.select([], {});
      expect(entityTable.size()).toBe(EntityData.length);
      updatedRecords.forEach(record => {
        expect(record.value).toBe(45);
        expect(record.status).toBe("archived_platform");
      });
    });

    it('update records with partial fields', async () => {
      const affectedRows = await entityTable.update({ name: 'Updated Name' }, { id: { eq: 3 } });
      expect(affectedRows).toBe(1);

      const updatedRecord = await entityTable.select([], { id: { eq: 3 } });
      expect(updatedRecord[0].name).toBe('Updated Name');
      expect(updatedRecord[0].value).toBe(30); // Ensure other fields are not affected
    });

    it('update a record PK', async () => {
      const ItemToTest = EntityData[1];
      const IdToUpdate = ItemToTest.id;
      const NewId = 99;
      const affectedRows = await entityTable.update({ id: NewId }, { id: { eq: IdToUpdate } });
      expect(affectedRows).toBe(1);

      // Check if the record with the new PK exists
      const updatedRecord = await entityTable.findByPk({ id: NewId });
      expect(updatedRecord).toEqual({ ...ItemToTest, id: NewId });

      // Check if the record with the old PK no longer exists
      const shouldNotExistRecord = await entityTable.findByPk({ id: IdToUpdate });
      expect(shouldNotExistRecord).toBeNull();
    });

    it('handle cases with empty updatedFields', async () => {
      const affectedRows = await entityTable.update({}, { id: { eq: 2 } });
      expect(affectedRows).toBe(0);
    });

    it('handle updates when multiple conditions match', async () => {
      const valuesToUpdate = { status: 'archived', value: 100 };
      const affectedRows = await entityTable.update(valuesToUpdate, { status: { eq: 'active' } });
      expect(affectedRows).toBe(2);

      const updatedRecords = await entityTable.select([], { status: { eq: 'archived' } });
      expect(updatedRecords).toHaveLength(2);
      expect(updatedRecords.map(record => record.value)).toEqual([100, 100]);
    });

    it('throw an error when updating a record with an existing PK', async () => {
      const ItemPkToTest = 2;
      const pkAlreadyRegistered = 3;
      const errorUpdate = async () => {
        await entityTable.update({ id: pkAlreadyRegistered }, { id: { gt: ItemPkToTest } });
      }
      await expect(errorUpdate)
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);
    });

    it('throw an error when updating many records with an unregistered PK', async () => {
      const unregisteredPK = 20;
      const expectedIdList = EntityData.map(item => item.id);
      expectedIdList[0] = unregisteredPK;

      const errorUpdate = async () => {
        await entityTable.update({ id: unregisteredPK }, {});
      }

      await expect(errorUpdate)
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);

      for (let expectedId of expectedIdList) {
        const record = await entityTable.findByPk({ id: expectedId });
        expect(record?.id).toBe(expectedId);
      }
    });

    it("update the PK of a record and insert a new record with the old PK", async () => {
      const InitialRegisteredPk = 2;
      const LoopCount = 20;
      const InitialUnregisteredPk = 1000;
      const EntityToInsert: Entity = { id: InitialRegisteredPk, name: "Kappa", value: 90, status: "active" };

      let currentUnregisteredPK = InitialUnregisteredPk;
      for (let i = 1; i <= LoopCount; i++) {
        currentUnregisteredPK++;
        // Update a field different from the PK
        const firstUpdateAffectedRows = await entityTable.update(
          { name: `Iota ${i}` },
          { id: { eq: InitialRegisteredPk } }
        );

        // Update the PK
        const updatedPkAffectedRows = await entityTable.update(
          { id: currentUnregisteredPK },
          { id: { eq: InitialRegisteredPk } }
        );

        // Find the record with the new PK
        const updatedPkRecord = await entityTable.findByPk({ id: currentUnregisteredPK });

        // Find the record with the old PK
        const oldPkRecord = null //await entityTable.findByPk({ id: InitialRegisteredPk });
        expect(firstUpdateAffectedRows).toBe(1);
        expect(updatedPkAffectedRows).toBe(1);
        expect(updatedPkRecord).not.toBeNull();
        expect(oldPkRecord).toBeNull();
        // Insert a new record with the old PK
        await expect(entityTable.insert(EntityToInsert)).resolves.not.toThrow();
        await expect(entityTable.insert(EntityToInsert)).rejects.toThrow(DuplicatePrimaryKeyValueError);
        // Find the recent inserted record with the old PK
        await expect(entityTable.findByPk({ id: InitialRegisteredPk })).not.toBeNull();
        
      }
      expect(entityTable.size()).toBe(EntityData.length + LoopCount);
    });

  });
}



type EntityWithDefaultId = Entity & { _id?: string };
const defaultEntityData: EntityWithDefaultId[] = [
  { id: 1, name: 'Epsilon', value: 50, status: 'active' },
  { id: 2, name: 'Zeta', value: 60, status: 'inactive' },
  { id: 3, name: 'Eta', value: 70, status: 'active' },
  { id: 4, name: 'Theta', value: 80, status: 'inactive' },
  { id: 5, name: 'Iota', value: 90, status: 'active' },
  { id: 6, name: 'Kappa', value: 100, status: 'inactive' }
];

/**
 * Common tests for update() method without a PK defined
 * 
 * @param description The description of the test
 * @param createInstance Function that return a new instance of Table< any > without PK.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 *  const table = new Table<any>({ primaryKey: [] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * ```
 */
export function updateTestWithoutPK(
  description: string, 
  createInstance: (testData: Array<any & { _id?: string }>) => Promise<Table<any & { _id?: string }>>
) {
  describe(description, () => {
    let entityTable: Table<EntityWithDefaultId>;

    beforeEach(async () => {
      entityTable = await createInstance(defaultEntityData);
    });

    it('update a single record based on a specific condition', async () => {
      const ItemToTest = defaultEntityData[0];
      const NewFieldsValues: Partial<Entity> = { status: 'archived' };

      const affectedRows = await entityTable.update(NewFieldsValues, { id: { eq: ItemToTest.id } });
      expect(affectedRows).toBe(1);

      const updatedRecords = await entityTable.select([], { id: { eq: ItemToTest.id } });
      const updatedRecord = updatedRecords[0];
      expect(updatedRecord._id).not.toBeUndefined();
      expect(updatedRecord).toEqual({
        ...ItemToTest,
        ...NewFieldsValues,
        _id: updatedRecord._id
      });
    });

    it('update a single record two times withouth changing the PK', async () => {
      const UpdatedData1 = defaultEntityData[4];
      const UpdatedData2 = defaultEntityData[2];
      const ItemToTest = (await entityTable.select([], { id: { eq: 2 } }))[0];
      expect(ItemToTest).not.toBeUndefined();

      // First update
      const affectedUpdate1 = await entityTable.update(UpdatedData1, { _id: { eq: ItemToTest._id } });
      expect(affectedUpdate1).toBe(1);

      const updatedRecord1 = await entityTable.findByPk({ _id: ItemToTest._id });
      expect(updatedRecord1).toEqual({ ...UpdatedData1, _id: ItemToTest._id });

      // Second update
      const affectedUpdate2 = await entityTable.update(UpdatedData2, { _id: { eq: ItemToTest._id } });
      expect(affectedUpdate2).toBe(1);

      const updatedRecord2 = await entityTable.findByPk({ _id: ItemToTest._id });
      expect(updatedRecord2).toEqual({ ...UpdatedData2, _id: ItemToTest._id });

    });

    it('update multiple records matching a condition', async () => {
      const NewFieldsValues: Partial<Entity> = { id: 1, status: 'freeze' };

      const affectedRows = await entityTable.update(NewFieldsValues, { id: { gte: 1 } });
      expect(affectedRows).toBe(defaultEntityData.length);

      const updatedRecords = await entityTable.select([], { id: { eq: NewFieldsValues.id } });
      expect(updatedRecords).toHaveLength(defaultEntityData.length);
      for (const item of updatedRecords) {
        expect(item.id).toBe(NewFieldsValues.id);
        expect(item.status).toBe(NewFieldsValues.status);
      }
    });

    it('update the "_id" field of a record', async () => {
      const ItemToTest = defaultEntityData[2];
      const NewDefaultId = 'new-id';
      const NewFieldsValues: Partial<EntityWithDefaultId> = { _id: NewDefaultId };

      const findBeforUpdate = await entityTable.select([], { id: { eq: ItemToTest.id } });
      const beforeUpdate = findBeforUpdate[0];
      expect(beforeUpdate?._id).not.toBeUndefined();

      const affectedRows = await entityTable.update(NewFieldsValues, { id: { eq: ItemToTest.id } });
      expect(affectedRows).toBe(1);

      const updatedRecord = await entityTable.findByPk({ _id: NewDefaultId });
      const nonexistRecord = await entityTable.findByPk({ _id: beforeUpdate._id });

      expect(updatedRecord).toEqual({ ...ItemToTest, ...NewFieldsValues, _id: NewDefaultId });
      expect(nonexistRecord).toBeNull();
    });

    it('throw an error when updating records with an existing "_id"', async () => {
      const ItemToTest = await entityTable.insert(defaultEntityData[3]);
      async function tryToUpdate() {
        await entityTable.update({ _id: ItemToTest._id }, {});
      }

      await expect(tryToUpdate)
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);
    });

    it('throw an error when updating records with an unregistered "_id"', async () => {
      const UnregisteredDefaultId = 'unregistered-id';
      async function tryToUpdate() {
        await entityTable.update({ _id: UnregisteredDefaultId }, {});
      }

      await expect(tryToUpdate)
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);

      const updated = await entityTable.select([], { _id: { eq: UnregisteredDefaultId } });
      expect(updated).toHaveLength(1);
    });

  });
}



const enrollmentData: Enrollment[] = [
  { year: 2025, semester: 'Fall', courseId: 101, studentId: 1, grade: 60, resultStatus: 'pending', gradeStatus: 'loaded' },
  { year: 2025, semester: 'Fall', courseId: 111, studentId: 1, grade: 0, resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Spring', courseId: 102, studentId: 2, grade: 30, resultStatus: 'pending', gradeStatus: 'loaded' },
  { year: 2025, semester: 'Spring', courseId: 112, studentId: 2, grade: 0, resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Summer', courseId: 103, studentId: 3, grade: 87, resultStatus: 'pending', gradeStatus: 'loaded' },
  { year: 2025, semester: 'Summer', courseId: 113, studentId: 3, grade: 0, resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Fall', courseId: 104, studentId: 4, grade: 61, resultStatus: 'pending', gradeStatus: 'loaded' },
  { year: 2025, semester: 'Fall', courseId: 114, studentId: 4, grade: 0, resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2025, semester: 'Spring', courseId: 105, studentId: 5, grade: 59, resultStatus: 'pending', gradeStatus: 'loaded' },
  { year: 2025, semester: 'Spring', courseId: 115, studentId: 5, grade: 0, resultStatus: 'pending', gradeStatus: 'pending' }
];

/**
 * Common tests for update() method using a composite PK
 * 
 * @param description The description of the test
 * @param createInstance Function that return a new instance of Table< Enrollment > with a composite PK.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 *  const table = new Table<Enrollment>({ primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 */
export function updateTestWithCompositePK(description: string, createInstance: (testData: Enrollment[]) => Promise<Table<Enrollment>>) {
  describe(description, () => {
    let enrollmentTable: Table<Enrollment>;

    beforeEach(async () => {
      enrollmentTable = await createInstance(enrollmentData);
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
    });

    it('update a single record two times withouth changing the PK', async () => {
      const ItemToTest = enrollmentData[3];
      const WrongObtainedGrade = 59;
      const CorrectObtainedGrade = 75;

      // Update record with the wrong data
      const affectedRowsFirstUpdate = await enrollmentTable.update({
        grade: WrongObtainedGrade,
        gradeStatus: 'loaded',
        resultStatus: getResultStatus(WrongObtainedGrade)
      }, {
        year: { eq: ItemToTest.year },
        semester: { eq: ItemToTest.semester },
        courseId: { eq: ItemToTest.courseId },
        studentId: { eq: ItemToTest.studentId }
      });

      expect(affectedRowsFirstUpdate).toBe(1);

      // Verify if the record was updated with the wrong data
      const wrongUpdatedRecord = await enrollmentTable.findByPk({
        year: ItemToTest.year,
        semester: ItemToTest.semester,
        courseId: ItemToTest.courseId,
        studentId: ItemToTest.studentId
      });

      expect(wrongUpdatedRecord).toEqual({ 
        ...ItemToTest,
        grade: WrongObtainedGrade,
        gradeStatus: 'loaded',
        resultStatus: getResultStatus(WrongObtainedGrade)
      });

      // Update the record with the correct data
      const affectedRowsSecondUpdate = await enrollmentTable.update({
        grade: CorrectObtainedGrade,
        gradeStatus: 'loaded',
        resultStatus: getResultStatus(CorrectObtainedGrade)
      }, {
        year: { eq: ItemToTest.year },
        semester: { eq: ItemToTest.semester },
        courseId: { eq: ItemToTest.courseId },
        studentId: { eq: ItemToTest.studentId }
      });

      expect(affectedRowsFirstUpdate).toBe(1);

      // Verify if the record was updated with the wrong data
      const fixedUpdatedRecord = await enrollmentTable.findByPk({
        year: ItemToTest.year,
        semester: ItemToTest.semester,
        courseId: ItemToTest.courseId,
        studentId: ItemToTest.studentId
      });

      expect(fixedUpdatedRecord).toEqual({ 
        ...ItemToTest,
        grade: CorrectObtainedGrade,
        gradeStatus: 'loaded',
        resultStatus: getResultStatus(CorrectObtainedGrade)
      });
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

      for (let item of ListApproved) {
        const updatedRecord = await enrollmentTable.findByPk({
          year: item.year,
          semester: item.semester,
          courseId: item.courseId,
          studentId: item.studentId
        });
        expect(updatedRecord).toEqual({ ...item, resultStatus: 'approved' });
      }

      for (let item of listReproved) {
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

    it('update the composite PK of multiple records', async () => {
      const YearToTest = 2025;
      const SemesterToTest = 'Fall';
      const SemesterToUpdate = 'Summer';
      const ItemsShoudNotExistAfterUpdate = enrollmentData.filter(item => (
        item.year === YearToTest
        && item.semester === SemesterToTest
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
      for (let item of ItemsShoudNotExistAfterUpdate) {
        const record = await enrollmentTable.findByPk({
          year: item.year,
          semester: item.semester,
          courseId: item.courseId,
          studentId: item.studentId
        });
        expect(record).toBeNull();
      }
      expect(enrollmentTable.size()).toBe(enrollmentData.length);
    });

    it('update the composite PK of multiple records 2 times', async () => {
      const YearToTest = 2025;
      const OriginalSemester = 'Fall';
      const SemesterToUpdate = 'Summer';

      // Update the PK for the first time
      const affectedRowsFirstUpdate = await enrollmentTable.update(
        { semester: SemesterToUpdate }, 
        {
          year: { eq: YearToTest },
          semester: { eq: OriginalSemester }
        }
      );

      expect(affectedRowsFirstUpdate).toBe(4);

      // Get the updated records, these records shouldn't exist after the second update
      const shouldNotExistAtEnd = await enrollmentTable.select([], {
        year: { eq: YearToTest },
        semester: { eq: SemesterToUpdate }
      });

      expect(shouldNotExistAtEnd).toHaveLength(6);

      // Update the PK for the second time
      const affectedRowsSecondUpdate = await enrollmentTable.update(
        { semester: OriginalSemester }, 
        {
          year: { eq: YearToTest },
          semester: { eq: SemesterToUpdate }
        }
      );

      expect(affectedRowsSecondUpdate).toBe(6);

      // Check if the records with the original semester
      const secondUpdatedRecords = await enrollmentTable.select([], {
        year: { eq: YearToTest },
        semester: { eq: OriginalSemester }
      });
      expect(secondUpdatedRecords).toHaveLength(6);
      secondUpdatedRecords.forEach(item => {
        expect(item.year).toBe(YearToTest);
        expect(item.semester).toBe(OriginalSemester);
      });

      // Check if the records with the old semester no longer exist
      for (let item of shouldNotExistAtEnd) {
        const record = await enrollmentTable.findByPk({
          year: item.year,
          semester: item.semester,
          courseId: item.courseId,
          studentId: item.studentId
        });
        expect(record).toBeNull();
      }
      expect(enrollmentTable.size()).toBe(enrollmentData.length);
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
}
