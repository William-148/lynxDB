# LynxDB Examples
## Content
- [Database Operations](#database-operations)
  - [Reset Database](#reset-database)
  - [Insert](#insert)
  - [Bulk Insert](#bulk-insert)
  - [Find By Primary Key](#find-by-primary-key)
  - [Find One](#find-one)
  - [Select](#select)
  - [Update](#update)
  - [Delete](#delete-by-primary-key)
- [Logical Operators](#logical-operators)
  - [Operator And](#operator-and)
  - [Operator Or](#operator-or)
  - [Operator Not](#operator-not)

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

### Reset Database
To delete all records from all tables you can do the following:

```typescript
  db.reset()
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

### Find one
Retrieves the first record that satisfies the specific query.
```typescript
async function findOneExample() {
  // Find a user
  const userFound: User | null = await users.findOne({ email: "gethynf@dot.gt" });
  console.table([userFound]);
}
```

### Select
Selects records using a where clause and allows choosing specific fields.

You can select specific fields:
```typescript
async function selectExample() {
  const selectedUsers: Partial<User>[] = await users.select(
    ["id", "name"], // Fields to select
    { id: { $gt: 1 } } // Where clause
  );
  console.table(selectedUsers);
}
```

You can also select all fields:
```typescript
async function selectExample() {
  const allEnrollments: Enrollment[] = await enrollments.select({ 
    year: { $gte: 2023 },
    semester: { $eq: "Spring" } 
  });
  console.table(allEnrollments);
}
```

Getting all records and all fields:
```typescript
async function selectExample() {
  const allEnrollments: Enrollment[] = await enrollments.select();
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

## Logical Operators
Logical operators allow you to combine multiple conditions to build complex queries for your database.

### Operator `$and`
The `$and` operator is used to ensure that all specified conditions are met. It can be used implicitly by combining conditions within the same object or explicitly by using the $and keyword.

#### Implicit
When you provide multiple conditions within a single object, they are automatically combined using an implicit `$and`. For example:
```typescript
await db.get("example").select([], {
  id: { $gte: 3, $lte: 50 }, 
  name: { $like: "jennie%" } 
});

await db.get("example").select([], {
  name: { $like: "karen%" },
  email: { $like: "%@some%" }
});
```

#### Explicit
Using the `$and` operator explicitly can improve clarity, especially when combining more complex conditions:
```typescript
await db.get("example").select([], {
  $and: [ 
    { id: { $gte: 3 } },
    { id: { $lte: 50 } },
    { name: { $like: "carla%" } }
  ]
});
```

### Operator `$or`
The `$or` operator returns records that satisfy at least one of the specified conditions. Use it when you want to match any one of multiple possible criteria:

```typescript
await db.get("example").select([], {
  $or: [ 
    { id: { $gte: 3 } },
    { name: { $like: "erwin%" } },
    { email: { $like: "%@some.com" } }
  ]
});
```

### Operator `$not`
The `$not` operator negates a condition, returning records that do not match the specified criteria:

```typescript
await db.get("example").select([], {
    $not: { id: { $eq: 1 } }
});
```
### Combined
You can combine multiple logical operators to create even more powerful and flexible queries. For example, you might want to retrieve records that satisfy one set of conditions or another, while also applying negations within those conditions.

Consider the following example:
```typescript
await db.get("example").select([], {
  $or: [
    {
      $and: [
        { id: { $gte: 3 } },
        { id: { $lte: 50 } },
        { name: { $like: "josseline%" } }
      ]
    },
    {
      $and: [
        { email: { $like: "%some_email@%" } },
        { $not: { status: { $eq: "inactive" } } }
      ]
    }
  ]
});

```