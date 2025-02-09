import { TablesDefinition } from "../../src/types/table.type";
import { User } from "../types/user-test.type";
import { Enrollment } from "../types/enrollment-test.type";
import { LynxDB } from "../../src/core/database";
import { createCompleteUser, createRandomUser } from "../utils/user.utils";
import { TableSchema } from "../../src/types/table.type";

const tableConfigs: TablesDefinition<{
  users: User;
  enrrollments: Enrollment;
}> = {
  users: {
    primaryKey: ["id"],
  },
  enrrollments: {
    primaryKey: ["year", "semester", "courseId", "studentId"],
  },
};


describe("LynxDB Basic Tests", () => {
  let db: LynxDB<{ users: User; enrrollments: Enrollment }>;
  let users: TableSchema<User>;
  let enrrollments: TableSchema<Enrollment>;

  // Reset the database before each test to ensure isolation
  beforeEach(() => {
    db = new LynxDB(tableConfigs);
    users = db.get("users");
    enrrollments = db.get("enrrollments");
  });

  it("BulkInsert with duplicates (should fail)", async () => {
    // Insert a first record
    await users.insert(createRandomUser(1));
    
    // Attempt a bulkInsert that includes a duplicate primary key
    await expect(
      users.bulkInsert([
        createRandomUser(2),
        createRandomUser(1),
      ])
    ).rejects.toThrow(); // An error is expected due to duplication
  });

  it("Complex conditions in WHERE clause", async () => {
    // Insert multiple users
    await users.bulkInsert([
      createCompleteUser({ id: 1, fullName: "John Smith", email: "john.smith@domain.com" }),
      createCompleteUser({ id: 2, fullName: "Alice Doe", email: "alice.doe@another.com" }),
      createCompleteUser({ id: 3, fullName: "Bob Doe", email: "bob.doe@domain.com" }),
      createCompleteUser({ id: 4, fullName: "Charlie Brown", email: "charlie@domain.com" }),
      createCompleteUser({ id: 5, fullName: "Alice Wonderland", email: "alice@wonderland.com" }),
    ]);

    /*  
      Composite condition: 
      - id greater than 1 and less than 5  
      - name that contains "Doe"  
      - email that contains "domain"
    */
    const results = await users.select([], {
      id: { $gt: 1, $lt: 5 },
      fullName: { $like: "%Doe%" },
      email: { $like: "%domain%" },
    });

    // We expect to find only the user with id = 3 ("Bob Doe")
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3);
  });

  it("Complete course enrollment flow", async () => {
    // 1. Insert a user
    await users.insert(createRandomUser(10));

    // 2. Insert multiple enrollments for that user in different courses/semesters
    await enrrollments.bulkInsert([
      { year: 2025, semester: "Spring", courseId: 101, studentId: 10, grade: 0, resultStatus: "pending", gradeStatus: "pending" },
      { year: 2025, semester: "Spring", courseId: 102, studentId: 10, grade: 0, resultStatus: "pending", gradeStatus: "pending" },
      { year: 2025, semester: "Fall", courseId: 103, studentId: 10, grade: 0, resultStatus: "pending", gradeStatus: "pending" },
    ]);

    // 3. Update the enrollment for course 101
    const updateCount = await enrrollments.update(
      { grade: 85, resultStatus: "approved", gradeStatus: "loaded" },
      { year: { $eq: 2025 }, semester: { $eq: "Spring" }, courseId: { $eq: 101 }, studentId: { $eq: 10 } }
    );
    expect(updateCount).toBe(1);

    const updatedEnrollment = await enrrollments.findByPk({
      year: 2025,
      semester: "Spring",
      courseId: 101,
      studentId: 10,
    });
    expect(updatedEnrollment?.grade).toBe(85);
    expect(updatedEnrollment?.resultStatus).toBe("approved");

    // 4. Delete the enrollment for course 102
    const deletedEnrollment = await enrrollments.deleteByPk({
      year: 2025,
      semester: "Spring",
      courseId: 102,
      studentId: 10,
    });
    expect(deletedEnrollment).not.toBeNull();

    // 5. Verify that only 2 enrollments remain for the user
    const remainingEnrollments = await enrrollments.select([], { studentId: { $eq: 10 } });
    expect(remainingEnrollments).toHaveLength(2);
  });

  it("Bulk update and delete users", async () => {
    // Insert 20 users
    const userData: User[] = Array.from({ length: 20 }, (_, i) => createRandomUser(i + 1));

    await users.bulkInsert(userData);

    // Update all users with even ids, assigning them a fixed name "Updated"
    const updateCount = await users.update(
      { fullName: "Updated Fullname" },
      { id: { $includes: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] } }
    );
    expect(updateCount).toBe(10);

    // Verify that the updated users have the name "Updated"
    const updatedUsers = await users.select([], {
      id: { $includes: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
    });
    updatedUsers.forEach((user) => {
      expect(user.fullName).toBe("Updated Fullname");
    });

    // Delete all users with ids less than or equal to 5
    for (let i = 1; i <= 5; i++) {
      const deleted = await users.deleteByPk({ id: i });
      expect(deleted).not.toBeNull();
    }

    // Verify that no users with ids <= 5 exist
    const remainingUsers = await users.select([], {});
    const existUsersMinorEqual5 = remainingUsers.some((user) => user.id! <= 5);
    expect(existUsersMinorEqual5).toBeFalsy();
  });

  it("Update with no matches in WHERE", async () => {
    // Insert two users
    await users.bulkInsert([
      createRandomUser(1),
      createRandomUser(2)
    ]);

    // Attempt to update users whose emails do not match any existing ones
    const updateCount = await users.update(
      { fullName: "No Match" },
      { email: { $like: "no-match%" } }
    );
    expect(updateCount).toBe(0);
  });

  it("$like query in the middle of the string", async () => {
    // Insert users with varied names
    await users.bulkInsert([
      createCompleteUser({ id: 1, fullName: "Alexander Hamilton", email: "alex@domain.com" }),
      createCompleteUser({ id: 2, fullName: "Alexis Sanchez", email: "alexis@domain.com" }),
      createCompleteUser({ id: 3, fullName: "Xander Cage", email: "xander@domain.com" })
    ]);

    // Query to find users that contain "lex" in any part of their name
    const results = await users.select([], { fullName: { $like: "%lex%" } });
    expect(results).toHaveLength(2);
    const names = results.map((u) => u.fullName);
    expect(names).toEqual(expect.arrayContaining(["Alexander Hamilton", "Alexis Sanchez"]));
  });
});
