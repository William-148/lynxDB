import { PrimaryKeyValueNullError } from "../../../../src/core/errors/table.error";
import { ITable } from "../../../../src/types/table.type";
import { Enrollment } from "../../../types/enrollment-test.type";
import { Product } from "../../../types/product-test.type";

const products: Product[] = [
  { id: 1, name: 'Laptop', price: 999, stock: 5 },
  { id: 2, name: 'Mouse', price: 25, stock: 100 },
  { id: 3, name: 'Keyboard', price: 45, stock: 50 },
  { id: 4, name: 'Monitor', price: 200, stock: 10 },
  { id: 5, name: 'Webcam', price: 80, stock: 30 }
];

/**
 * Common tests for deleteByPk() method using a single PK
 * 
 * @description Describe the test
 * @param createInstance Function that return a new instance of Table< Product > with "id" as PK.
 * It is used to create a new instance of Table<Product> for each test.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 *  const table = new Table<Product>({ primaryKey: ['id'] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * 
 * ```
 */
export function deleteByPkTestWithSimplePK(createInstance: (testData: Product[]) => Promise<ITable<Product>>) {
  describe('Simple Primary Key', () => {
    let table: ITable<Product>;
  
    beforeEach(async () => {
      table = await createInstance(products);
    });
  
    it('should delete existing committed record', async () => {
      // Arrange
      const newProducts: Product[] = [
        { id: 101, name: 'Laptop', price: 999, stock: 5 },
        { id: 102, name: 'Mouse', price: 25, stock: 100 }
      ];
      await table.bulkInsert(newProducts);
  
      // Act
      const deletedA = await table.deleteByPk({ id: 1 });
      const foundA = await table.findByPk({ id: 1 });

      const deletedB = await table.deleteByPk({ id: 101 });
      const foundB = await table.findByPk({ id: 101 });
  
      // Assert
      expect(deletedA).toEqual(products[0]);
      expect(foundA).toBeNull();
      expect(deletedB).toEqual(newProducts[0]);
      expect(foundB).toBeNull();
    });
  
    it('should return null when deleting non-existent record', async () => {
      // Act
      const deleted = await table.deleteByPk({ id: 999 });
      const found = await table.findByPk({ id: 999 });
  
      // Assert
      expect(deleted).toBeNull();
      expect(found).toBeNull();
    });

    it('should return the deleted record then return null when deleting 2 times', async () => {
      const productToDelete = products[1];
      // Act
      const deleted1 = await table.deleteByPk({ id: productToDelete.id });
      const deleted2 = await table.deleteByPk({ id: productToDelete.id });
      const found = await table.findByPk({ id: productToDelete.id });

      // Assert
      expect(deleted1).toEqual(productToDelete);
      expect(deleted2).toBeNull();
      expect(found).toBeNull();
    });

    it('should throw an error when the PK is not provided', async () => {
      // Act & Assert
      await expect(table.deleteByPk({})).rejects.toThrow(PrimaryKeyValueNullError);
    });
  
    it('should delete newly inserted temporary record', async () => {
      // Arrange
      const tempProduct = { id: 103, name: 'Keyboard', price: 45, stock: 50 };
      await table.insert(tempProduct);
  
      // Act
      const deleted = await table.deleteByPk({ id: tempProduct.id });
      const found = await table.findByPk({ id: tempProduct.id });
  
      // Assert
      expect(deleted).toEqual(tempProduct);
      expect(found).toBeNull();
    });
  
    it('should delete updated record with same PK', async () => {
      // Arrange
      const originalProductA = products[3];
      const originalProductB = { id: 104, name: 'Monitor', price: 200, stock: 10 };
      await table.insert(originalProductB);

      const updatedProductA = { ...originalProductA, price: 190 };
      const updatedProductB = { ...originalProductB, price: 180 };

      await table.update(updatedProductA, { id: { $eq: originalProductA.id} });
      await table.update(updatedProductB, { id: { $eq: originalProductB.id} });
      // Act
      const deletedA = await table.deleteByPk({ id: originalProductA.id });
      const foundA = await table.findByPk({ id: originalProductA.id });

      const deletedB = await table.deleteByPk({ id: originalProductB.id });
      const foundB = await table.findByPk({ id: originalProductB.id });
  
      // Assert
      expect(deletedA).toEqual(updatedProductA);
      expect(foundA).toBeNull();

      expect(deletedB).toEqual(updatedProductB);
      expect(foundB).toBeNull();
    });
  
    it('should handle record with updated PK', async () => {
      // Arrange
      const original = { id: 105, name: 'Webcam', price: 80, stock: 30 };
      await table.bulkInsert([original]);
      const updated = { id: 106, name: 'Webcam HD', price: 100, stock: 25 };
      await table.update(updated, { id: { $eq: original.id } });
  
      // Act & Assert
      const deleteOldPk = await table.deleteByPk({ id: original.id });
      const deleteNewPk = await table.deleteByPk({ id: updated.id });
      const foundOld = await table.findByPk({ id: original.id });
      const foundNew = await table.findByPk({ id: updated.id });
  
      expect(deleteOldPk).toBeNull();
      expect(deleteNewPk).toEqual(updated);
      expect(foundOld).toBeNull();
      expect(foundNew).toBeNull();
    });

    it('should delete a record and insert it again', async () => {
      // Arrange
      const LoopCount = 7;
      const existingProduct = products[2];
      const newProduct = { id: 107, name: 'Mouse RGB', price: 25, stock: 100 };
      await table.insert(newProduct);

      for (let i = 0; i < LoopCount; i++) {
        // Act
        const deletedA = await table.deleteByPk({ id: existingProduct.id });
        const foundA = await table.findByPk({ id: existingProduct.id });
        await table.insert(existingProduct);
        const foundAgainA = await table.findByPk({ id: existingProduct.id });

        const deletedB = await table.deleteByPk({ id: newProduct.id });
        const foundB = await table.findByPk({ id: newProduct.id });
        await table.insert(newProduct);
        const foundAgainB = await table.findByPk({ id: newProduct.id });
  
        // Assert
        expect(deletedA).toEqual(existingProduct);
        expect(foundA).toBeNull();
        expect(foundAgainA).toEqual(existingProduct);

        expect(deletedB).toEqual(newProduct);
        expect(foundB).toBeNull();
        expect(foundAgainB).toEqual(newProduct);
      }
      expect(table.size()).toBe(products.length + 1);
    });

    it('should update and then delete a record', async () => {
      // Arrange
      const LoopCount = 7;
      const existingProduct = products[2];
      const newProduct = { id: 101, name: 'Mouse RGB', price: 25, stock: 100 };
      await table.insert(newProduct);
      const updatedExistingProduct = { ...existingProduct, id:120,  price: 50 };
      const updatedNewProduct = { ...newProduct, id:121, price: 30 };

      for (let i = 0; i < LoopCount; i++) {
      // Act
        await table.update(updatedExistingProduct, { id: { $eq: existingProduct.id } });
        // Delete and try to find the updated record
        const toDeleteIdA = updatedExistingProduct.id;
        const deletedA = await table.deleteByPk({ id: toDeleteIdA });
        const foundA = await table.findByPk({ id: toDeleteIdA });
        // Try to find the record with the original id and insert it again
        const foundOriginalA = await table.findByPk({ id: existingProduct.id });
        await table.insert(existingProduct);
        const foundAgainA = await table.findByPk({ id: existingProduct.id });


        await table.update(updatedNewProduct, { id: { $eq: newProduct.id } });
        // Delete and try to find the updated record
        const toDeletIdB = updatedNewProduct.id;
        const deletedB = await table.deleteByPk({ id: toDeletIdB });
        const foundB = await table.findByPk({ id: toDeletIdB });
        // Try to find the record with the original id and insert it again
        const foundOriginalB = await table.findByPk({ id: newProduct.id });
        await table.insert(newProduct);
        const foundAgainB = await table.findByPk({ id: newProduct.id });
  
      // Assert
        expect(deletedA).toEqual(updatedExistingProduct);
        expect(foundA).toBeNull();
        expect(foundOriginalA).toBeNull();
        expect(foundAgainA).toEqual(existingProduct);

        expect(deletedB).toEqual(updatedNewProduct);
        expect(foundB).toBeNull();
        expect(foundOriginalB).toBeNull();
        expect(foundAgainB).toEqual(newProduct);
      }
      expect(table.size()).toBe(products.length + 1);
    });
  });
}


/**
 * Common tests for deleteByPk() method using a default PK
 * 
 * @description Describe the test
 * @param createInstance Function that return a new instance of Table< Product > with default PK.
 * It is used to create a new instance of Table<Product> for each test.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 *  const table = new Table<Product>({ primaryKey: [] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * 
 * ```
 */
export function deleteByPkTestWithDefaultPK(createInstance: (testData: Product[]) => Promise<ITable<Product & { _id?: string }>>) {
  describe('Default Primary Key', () => {
    let table: ITable<Product & { _id?: string }>;

    beforeEach(async () => {
      table = await createInstance(products);
    });

    it('should delete existing committed record', async () => {
      // Arrange
      const newProducts: Product[] = [
        { id: 101, name: 'Laptop', price: 999, stock: 5 },
        { id: 102, name: 'Mouse', price: 25, stock: 100 }
      ];
      await table.bulkInsert(newProducts);

      // Act
      const withIdA = (await table.select([], { id: { $eq: 1 } }))[0];
      const deletedA = await table.deleteByPk({ _id: withIdA._id });
      const foundA = await table.findByPk({ _id: withIdA._id });

      const withIdB = (await table.select([], { id: { $eq: 101 } }))[0];
      const deletedB = await table.deleteByPk({ _id: withIdB._id });
      const foundB = await table.findByPk({ _id: withIdB._id });

      // Assert
      expect(deletedA).toEqual({ ...products[0], _id: withIdA._id });
      expect(foundA).toBeNull();
      expect(deletedB).toEqual({ ...newProducts[0], _id: withIdB._id });
      expect(foundB).toBeNull();
    });

    it('should return null when deleting non-existent record', async () => {
      // Act
      const deleted = await table.deleteByPk({ _id: 'non-exist' });
      const found = await table.findByPk({ _id: 'non-exist' });
  
      // Assert
      expect(deleted).toBeNull();
      expect(found).toBeNull();
    });

    it('should throw an error when the PK is not provided', async () => {
      // Act & Assert
      await expect(table.deleteByPk({})).rejects.toThrow(PrimaryKeyValueNullError);
    });
    
  });
};


const enrollmentsTestData: Enrollment[] = [
  { year: 2023, semester: 'Spring', courseId: 101, studentId: 1, grade: 85, resultStatus: 'approved', gradeStatus: 'loaded' },
  { year: 2023, semester: 'Fall', courseId: 102, studentId: 2, grade: 65, resultStatus: 'reproved', gradeStatus: 'loaded' },
  { year: 2024, semester: 'Summer', courseId: 103, studentId: 3, grade: 0, resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2024, semester: 'Spring', courseId: 101, studentId: 1, grade: 72, resultStatus: 'approved', gradeStatus: 'loaded' },
  { year: 2023, semester: 'Fall', courseId: 104, studentId: 4, grade: 68, resultStatus: 'reproved', gradeStatus: 'loaded' },
  { year: 2024, semester: 'Fall', courseId: 105, studentId: 5, grade: 90, resultStatus: 'approved', gradeStatus: 'loaded' },
  { year: 2023, semester: 'Summer', courseId: 106, studentId: 6, grade: 0, resultStatus: 'reproved', gradeStatus: 'loaded' },
  { year: 2024, semester: 'Spring', courseId: 107, studentId: 7, grade: 70, resultStatus: 'approved', gradeStatus: 'loaded' },
  { year: 2023, semester: 'Fall', courseId: 108, studentId: 8, grade: 0, resultStatus: 'pending', gradeStatus: 'pending' },
  { year: 2024, semester: 'Summer', courseId: 109, studentId: 9, grade: 60, resultStatus: 'reproved', gradeStatus: 'loaded' }
];

/**
 * Common tests for deleteByPk() method using a composite PK
 * 
 * @param createInstance Function that return a new instance of Table< Enrollment > 
 * with "year", "semester", "courseId" and "studentId" as PK.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 * const table = new Table<Enrollment>({ primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
 * await table.bulkInsert(testData);
 * return table;
 * }
 * ```
 */
export function deleteByPkTestWithCompositePK(createInstance: (testData: Enrollment[]) => Promise<ITable<Enrollment>>) {
  describe('Composite Primary Key', () => {
  
    let table: ITable<Enrollment>;
  
    beforeEach(async () => {
      table = await createInstance(enrollmentsTestData);
    });
  
    it('should delete record with composite key', async () => {
      // Arrange
      const enrollment: Enrollment = {
        year: 2023, semester: 'Fall', courseId: 101, studentId: 5001, grade: 85, resultStatus: 'approved', gradeStatus: 'loaded'
      };
      await table.insert(enrollment);
      const primaryKey = { 
        year: enrollment.year, 
        semester: enrollment.semester, 
        courseId: enrollment.courseId, 
        studentId: enrollment.studentId 
      };
  
      // Act
      const deleted = await table.deleteByPk(primaryKey);
      const found = await table.findByPk(primaryKey);
  
      // Assert
      expect(deleted).toEqual(enrollment);
      expect(found).toBeNull();
    });

    it('should throw an error when the PK is not provided', async () => {
      // Act & Assert
      await expect(table.deleteByPk({ year: 2021 })).rejects.toThrow(PrimaryKeyValueNullError);
    });
  
    it('should handle partial key mismatch', async () => {
      // Arrange
      const enrollment: Enrollment = {
        year: 2024,
        semester: 'Spring',
        courseId: 102,
        studentId: 5002,
        grade: 0,
        resultStatus: 'pending',
        gradeStatus: 'pending'
      };
      await table.insert(enrollment);
  
      // Act
      const deleteWrongKey = await table.deleteByPk({
        year: 2024,
        semester: 'Spring',
        courseId: 102,
        studentId: 5003 // Wrong studentId
      });
      const found = await table.findByPk({
        year: 2024,
        semester: 'Spring',
        courseId: 102,
        studentId: 5002
      });
  
      // Assert
      expect(deleteWrongKey).toBeNull();
      expect(found).toEqual(enrollment);
    });
  
    it('should handle composite key with updated PK', async () => {
      // Arrange
      const original: Enrollment = {
        year: 2023,
        semester: 'Fall',
        courseId: 301,
        studentId: 7001,
        grade: 90,
        resultStatus: 'approved',
        gradeStatus: 'loaded'
      };
      await table.bulkInsert([original]);

      const updated: Enrollment = {
        ...original,
        studentId: 7002, // Changing studentId (part of PK)
        grade: 95
      };
      await table.update(updated, { 
        year: { $eq: original.year },
        semester: { $eq: original.semester },
        courseId: { $eq: original.courseId },
        studentId: { $eq: original.studentId }
      });
  
      // Act
      const deleteOriginalPk = await table.deleteByPk({
        year: 2023,
        semester: 'Fall',
        courseId: 301,
        studentId: 7001
      });
      const deleteNewPk = await table.deleteByPk({
        year: 2023,
        semester: 'Fall',
        courseId: 301,
        studentId: 7002
      });
  
      // Assert
      expect(deleteOriginalPk).toBeNull();
      expect(deleteNewPk).toEqual(updated);
    });

    it('should delete a record and insert it again', async () => {
      // Arrange
      const LoopCount = 7;
      const existingEnrrollment = enrollmentsTestData[2];
      const newEnrrollment: Enrollment = {
        year: 2023,
        semester: 'Fall',
        courseId: 301,
        studentId: 7001,
        grade: 90,
        resultStatus: 'approved',
        gradeStatus: 'loaded'
      }
      await table.insert(newEnrrollment);

      for (let i = 0; i < LoopCount; i++) {
        // Act
        const deletedA = await table.deleteByPk(existingEnrrollment);
        const foundA = await table.findByPk(existingEnrrollment);
        await table.insert(existingEnrrollment);
        const foundAgainA = await table.findByPk(existingEnrrollment);

        const deletedB = await table.deleteByPk(newEnrrollment);
        const foundB = await table.findByPk(newEnrrollment);
        await table.insert(newEnrrollment);
        const foundAgainB = await table.findByPk(newEnrrollment);
  
        // Assert
        expect(deletedA).toEqual(existingEnrrollment);
        expect(foundA).toBeNull();
        expect(foundAgainA).toEqual(existingEnrrollment);

        expect(deletedB).toEqual(newEnrrollment);
        expect(foundB).toBeNull();
        expect(foundAgainB).toEqual(newEnrrollment);
      }
      expect(table.size()).toBe(enrollmentsTestData.length + 1);
    });

    it('should update and then delete a record', async () => {
      // Arrange
      const LoopCount = 7;
      const existingEnrrollment = enrollmentsTestData[2];
      const newEnrrollment: Enrollment = {
        year: 2023,
        semester: 'Fall',
        courseId: 301,
        studentId: 7001,
        grade: 90,
        resultStatus: 'approved',
        gradeStatus: 'loaded'
      }
      await table.insert(newEnrrollment);
      const updatedExistingEnrrollment: Enrollment = { 
        ...existingEnrrollment,
        courseId: 1103,
        grade: 65,
        resultStatus: 'approved',
        gradeStatus: 'loaded'
      };
      const updatedNewEnrrollment: Enrollment = { 
        ...newEnrrollment, 
        courseId: 1301,
        grade: 51,
        resultStatus: 'reproved',
      };

      for (let i = 0; i < LoopCount; i++) {
      // Act 
        //----
        await table.update(updatedExistingEnrrollment, { 
          year: { $eq: existingEnrrollment.year },
          semester: { $eq: existingEnrrollment.semester },
          courseId: { $eq: existingEnrrollment.courseId },
          studentId: { $eq: existingEnrrollment.studentId }
        });
        // Delete and try to find the updated record
        const deletedA = await table.deleteByPk(updatedExistingEnrrollment);
        const foundA = await table.findByPk(updatedExistingEnrrollment);
        // Try to find the record with the original id and insert it again
        const foundOriginalA = await table.findByPk(existingEnrrollment);
        await table.insert(existingEnrrollment);
        const foundAgainA = await table.findByPk(existingEnrrollment);

        //----
        await table.update(updatedNewEnrrollment, { 
          year: { $eq: newEnrrollment.year },
          semester: { $eq: newEnrrollment.semester },
          courseId: { $eq: newEnrrollment.courseId },
          studentId: { $eq: newEnrrollment.studentId }
        });
        // Delete and try to find the updated record
        const deletedB = await table.deleteByPk(updatedNewEnrrollment);
        const foundB = await table.findByPk(updatedNewEnrrollment);
        // Try to find the record with the original id and insert it again
        const foundOriginalB = await table.findByPk(newEnrrollment);
        await table.insert(newEnrrollment);
        const foundAgainB = await table.findByPk(newEnrrollment);
  
      // Assert
        expect(deletedA).toEqual(updatedExistingEnrrollment);
        expect(foundA).toBeNull();
        expect(foundOriginalA).toBeNull();
        expect(foundAgainA).toEqual(existingEnrrollment);

        expect(deletedB).toEqual(updatedNewEnrrollment);
        expect(foundB).toBeNull();
        expect(foundOriginalB).toBeNull();
        expect(foundAgainB).toEqual(newEnrrollment);
      }
      expect(table.size()).toBe(enrollmentsTestData.length + 1);
    });
  });
}