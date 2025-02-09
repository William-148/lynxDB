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
    { id: { $includes: [1, 2, 3] } } // Where clause
  );

  // String pattern match
  await users.select([], 
    { name: { $like: "Jhon%" } } // Where clause
  );
}

async function logicalOperatorsInWhereClause(){
  /* - Operator $or not supported yet
   * - Operator $not not supported yet
   * - Operator $and not supported yet
   */

  // Operator and can be simulated by adding multiple conditions
  await users.select([], 
    { // Where clause 
      id: { $eq: 1 }, 
      name: { $like: "Jhon%" } 
    }
  );
  await users.select([], 
    { // Where clause
      name: { $like: "Jhon%" },
      email: { $like: "some%" },
      // otras condiciones
      // another conditions
    }
  );
}


// type Post = { 
//   id: number; 
//   title: string; 
//   content: string; 
//   ownerId: number; 
// }
// async function main (){
//   try{
//     const result = await db.transaction(async (t) => {
//       const userA = await t.get("users").insert({ id:1, name: "Josué Alfredo Gonzalez Caal" });
//       const userB = await t.get("users").insert({ id: "3485128450101", name: "Edin Roberto Ramirez Perez" });
//       const affectedRows = await t.get("users").update({ name: "Kenneth Jhoel Moreno Perez" }, { cui: { $eq: "7845674320103"} });
//       if (affectedRows !== 1) throw new Error("No se actualizo el usuario");
//       return [userA, userB];
//     });
//     console.log("TRANSACTION RESULT:");
//     console.table(result);
//   }
//   catch(error){
//     console.log("TRANSACTION ERROR:");
//     console.error(error);
//   }
//   console.log("AFTER TRANSACTION:");
//   console.table(await db.get('users').select([], {}));
// }

// main();


/**
Proyecto: Lynx Db
Descripción del proyecto:
El proyecto es una base de datos en memoria que permite realizar operaciones CRUD en tablas definidas por el usuario. 
La base de datos soporta transacciones y permite definir los niveles de aislamiento de las transacciones.

Clases principales:
- Table: Representa una tabla de la base de datos. Permite realizar operaciones CRUD.
  * Tiene un Map para almacenar PK -> Row.
  * Tiene un Array para almacenar los Rows.
  * Tiene un Objeto RecordLockManager para manejar los locks de las filas.
  * No realiza bloqueos sino que aplica los cambios directamente.
  * Solo espera a que los registros sean liberados para poder realizar operaciones.

- TransactionTable: Extiende de Table y realiza las mismas operaciones (CRUD).
  * Recibe en el constructor una instancia de Table para copiar la referencia del Map, Array y RecordLockManager.
    No modifica las referencias sino que solo realiza operaciones de lectura.
  * Para los cambios, utiliza sus propias estructuras temporales (Map y Array) para no modificar los datos de la tabla original.
    Los cambios se aplican al hacer commit o se descartan al hacer rollback.
  * Realiza bloqueos de filas con locks compartidos o exclusivos. 
    Cuando se realizan lecturas adquiere shared locks o exclusive locks (dependiendo el nivel de aislamiento).
    En escrituras adquiere exclusive locks.
  * Al hacer commit, aplica los cambios a la tabla original y libera los locks.



*/