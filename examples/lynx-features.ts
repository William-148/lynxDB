import { LynxDB, TablesDefinition } from "../src";

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


// Define the configurations for the tables
const tableConfigs: TablesDefinition<{
  users: User,
  enrrollments: Enrollment
}> = {
  users: {
    primaryKey: ["id"] // Single primary key
  },
  enrrollments: {
    primaryKey: ["year", "semester", "courseId", "studentId"] // Composite primary key
  }
};
// Create a new instance of LynxDB
const db = new LynxDB(tableConfigs);

// Get tables
const users = db.get("users");
const enrrollments = db.get("enrrollments");

async function operations(){
  // Operation Insert 
  const userInserted: User = await users.insert({ id: 1 , name: "Jhon Smith", email: "some@domain.com" });
  const enrrollmentInserted: Enrollment = await enrrollments.insert({ 
    year: 2025, 
    semester: "Spring", 
    courseId: 1, 
    studentId: 1, 
    grade: 0, 
    resultStatus: "pending", 
    gradeStatus: "pending" 
  });

  console.table([userInserted]);
  console.table([enrrollmentInserted]);
  
  // Operation Bulk Insert
  await users.bulkInsert([
    { id: 2, name: "Alice Doe", email: "alice@domain.com" },
    // ... more records
  ]);
  await enrrollments.bulkInsert([
    { 
      year: 2025, 
      semester: "Spring", 
      courseId: 1, 
      studentId: 2, 
      grade: 0, 
      resultStatus: "pending", 
      gradeStatus: "pending" 
    },
    // ... more records
  ]);
  
  // Opeartion Find By Primary Key
  const userFound: User | null = await users.findByPk({ id: 1 });
  const enrrollmentFound: Enrollment | null = await enrrollments.findByPk({ 
    year: 2025, 
    semester: "Spring", 
    courseId: 1, 
    studentId: 1 
  });

  console.table([userFound]);
  console.table([enrrollmentFound]);

  // Select
  const usersSelected: Partial<User>[] = await users.select(
    ["id", "name"], // Fields to select, array empty ([]) to select all fields
    { id: { $gt: 1 } } // Where clause, empty object({}) to select all records
  );
  const enrollmentSelected: Partial<Enrollment>[] = await enrrollments.select(
    [], // Select all fields 
    { // Where clause
      year: { $gt: 2025 },
      semester: { $eq: "Spring" }
    }
  );

  console.table(usersSelected);
  console.table(enrollmentSelected);

  // Operation Update
  const affectedRowsUser = await users.update(
    { name: "Jhon Doe" }, // Fields to update
    { id: { $eq: 1 } } // Where clause
  );
  const affectedRowsEnrrollment = await enrrollments.update(
    { // Fields to update
      grade: 72,
      resultStatus: "approved",
      gradeStatus: "loaded"
    },
    { // Where clause
      year: { $eq: 2025 }, 
      semester: { $eq: "Spring" }, 
      courseId: { $eq: 1 }, 
      studentId: { $eq: 1 } 
    }
  );

  console.log("Affected rows user:", affectedRowsUser);
  console.log("Affected rows enrrollment:", affectedRowsEnrrollment);

  // Operation Delete By Primary Key
  const userDelete: User | null = await users.deleteByPk({ id: 1 });
  const enrrollmentDelete: Enrollment | null = await enrrollments.deleteByPk({ 
    year: 2025, 
    semester: "Spring", 
    courseId: 1, 
    studentId: 1 
  });

  console.table([userDelete]); // If null, the record was not found
  console.table([enrrollmentDelete]); // If null, the record was not found
}

// Where clause are in select and update operations
async function comparisonOperatorInWhereClause(){
  // Equal to
  const resultWithEq = await users.select(
    [], 
    { id: { $eq: 1 } } // Where clause
  );
  const affectedRowsWithEq = await users.update(
    { /* updated fields */ }, 
    { id: { $eq: 1 } } // Where clause
  );
  console.table(resultWithEq);
  console.log("Affected rows with $eq:", affectedRowsWithEq);

  // Not equal to
  await users.select([], 
    { id: { $ne: 1 } } // Where clause
  );

  // Greater than
  await users.select([], 
    { id: { $gt: 1 } } // Where clause
  );

  // Greater than or equal to
  await users.select([], 
    { id: { $gte: 1 } } // Where clause
  );

  // Less than
  await users.select([], 
    { id: { $lt: 1 } } // Where clause
  );

  // Less than or equal to
  await users.select([], 
    { id: { $lte: 1 } } // Where clause
  );

  // Array inclusion check
  await users.select([], 
    { id: { $in: [1, 2, 3] } } // Where clause
  );

  // Array exclusion check
  await users.select([], 
    { id: { $nin: [1, 2, 3] } } // Where clause
  );

  // String pattern match
  await users.select([], 
    { name: { $like: "Jhon%" } } // Where clause
  );
}

async function logicalOperatorsInWhereClause(){
  // Operator "and" implicit
  await users.select([], 
    { // Where clause 
      id: { $gte: 3, $lte: 50 }, 
      name: { $like: "jhon%" } 
    }
  );
  await users.select([], 
    { // Where clause
      name: { $like: "jhon%" },
      email: { $like: "some%" },
      // another conditions
    }
  );

  // Operator "and" explicit
  await users.select([], 
    { // Where clause
      $and: [ 
        { id: { $gte: 3 } },
        { id: { $lte: 50 } },
        { name: { $like: "jhon%" } }
      ]
    }
  );

  // Operator "or"
  await users.select([], {
    $or: [ 
      { id: { $gte: 3 } },
      { name: { $like: "jhon%" } },
      { email: { $like: "%@some.com" } }
    ]
  });

  // Operator "not"
  await users.select([], {
      $not: { id: { $eq: 1 } }
  });
}
