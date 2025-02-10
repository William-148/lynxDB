# LynxDB Examples
## Content
- [Database Operations](#database-operations)
  - [Insert](#insert)
  - [Bulk Insert](#bulk-insert)
  - [Find By Primary Key](#find-by-primary-key)
  - [Select](#select)
  - [Update](#update)
  - [Delete](#delete-by-primary-key)

## Database Operations
First, you need to import the necessary modules into your application. 
```typescript
import { LynxDB, TablesDefinition } from "lynxdb";
```

Create the types for the tables:

```typescript
type User = {
  id: number; 
  name: string;
  email: string; 
}
type Enrollment = {
  year: number;
  semester: 'Spring' | 'Summer' | 'Fall';
  courseId: number; 
  studentId: number; 
  grade: number;
  resultStatus: 'pending' | 'approved' | 'reproved';
  gradeStatus: 'pending' | 'loaded';
}
```

Create the table definition:
```typescript
// Define a type that lists all the tables in the database
type MyTables = {
  users: User,
  enrollments: Enrollment
}

// Define the configurations for the tables
const tableConfigs: TablesDefinition<MyTables> = {
  users: {
    // Simple primary key
    primaryKey: ["id"] 
  },
  enrollments: {
    // Composite primary key
    primaryKey: ["year", "semester", "courseId", "studentId"]
  }
};
```

Create a new instance of LynxDB:
```typescript
const db = new LynxDB(tableConfigs);
```

Getting the tables for operations:
```typescript
const users = db.get("users");
const enrollments = db.get("enrollments");
```


### Insert
Inserts a single record and returns the newly inserted record.
```typescript
async function singleInsertExample() {
  const userInserted: User = await db.get("users").insert({
    id: 1,
    name: "Jhon Smith",
    email: "some@domain.com"
  });
  console.table([userInserted]);
}
```

### Bulk Insert

Inserts multiple records at once.
```typescript
async function bulkInsertExample() {
  // Insert multiple users
  await users.bulkInsert([
    { id: 2, name: "Alice Doe", email: "alice@domain.com" },
    { id: 3, name: "Bob Johnson", email: "bob@domain.com" }
  ]);

  // Insert multiple enrollments
  await enrollments.bulkInsert([
    {
      year: 2025,
      semester: "Spring",
      courseId: 1,
      studentId: 1,
      grade: 0,
      resultStatus: "pending",
      gradeStatus: "pending"
    },
    {
      year: 2025,
      semester: "Spring",
      courseId: 2,
      studentId: 1,
      grade: 55,
      resultStatus: "reproved",
      gradeStatus: "loaded"
    }
  ]);
}
```

### Find by Primary Key
Retrieves a record using its primary key (or composite key).

```typescript
async function findByPkExample() {
  // Find a user by primary key
  const userFound: User | null = await users.findByPk({ id: 1 });
  console.table([userFound]);

  // Find an enrollment by composite primary key
  const enrollmentFound: Enrollment | null = await enrollments.findByPk({
    year: 2025,
    semester: "Spring",
    courseId: 1,
    studentId: 1
  });
  console.table([enrollmentFound]);
}
```

### Select
Selects records using a where clause and allows choosing specific fields.
```typescript
async function selectExample() {
  // Select specific fields with a condition
  const selectedUsers: Partial<User>[] = await users.select(
    ["id", "name"],
    { id: { $gt: 1 } }
  );
  console.table(selectedUsers);

  // Select all fields (using an empty array) with a filtering condition
  const allEnrollments: Partial<Enrollment>[] = await enrollments.select(
    [],
    { 
      year: { $gte: 2023 },
      semester: { $eq: "Spring" } 
    }
  );
  console.table(allEnrollments);
}

```

### Update
Updates records matching the specified criteria.

```typescript
async function updateExample() {
  // Update a user's name
  const affectedRowsUser = await users.update(
    { name: "Jhon Doe" },
    { id: { $eq: 1 } }
  );
  console.log("Affected rows (user):", affectedRowsUser);

  // Update an enrollment record's grade and status
  const affectedRowsEnrollment = await enrollments.update(
    { grade: 72, resultStatus: "approved", gradeStatus: "loaded" },
    {
      year: { $eq: 2025 },
      semester: { $eq: "Spring" },
      courseId: { $eq: 1 },
      studentId: { $eq: 1 }
    }
  );
  console.log("Affected rows (enrollment):", affectedRowsEnrollment);
}

```

### Delete By Primary Key
Deletes a record by its primary key (or composite key) and returns the deleted record.

```typescript
async function deleteExample() {
  // Delete a user by primary key
  const userDeleted: User | null = await users.deleteByPk({ id: 1 });
  console.table([userDeleted]);

  // Delete an enrollment by composite primary key
  const enrollmentDeleted: Enrollment | null = await enrollments.deleteByPk({
    year: 2025,
    semester: "Spring",
    courseId: 1,
    studentId: 1
  });
  console.table([enrollmentDeleted]);
}
```