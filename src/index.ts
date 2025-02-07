import { LynxDB } from "./core/data-base";
import { TablesDefinition } from "./types/table.type";

type User = { id: number; name: string; email: string; }
type Post = { id: number; title: string; content: string; ownerId: number; }

// Define the configurations for the tables
const tableConfigs: TablesDefinition<{
  users: User,
  post: Post
}> = {
  users: {
    primaryKey: ["id"]
  },
  post: {
    primaryKey: ["id"]
  }
};

const db = new LynxDB(tableConfigs);

const users = db.get("users");
const posts = db.get("post");

users.insert({ id: 1 , name: "Jhon Smith", email: "some@domain.com" });
posts.insert({ id: 1, title: "First Post", content: "This is the first post", ownerId: 1 });


// async function main (){
//   try{
//     const result = await db.transaction(async (t) => {
//       const userA = await t.get("users").insert({ id:1, name: "Josué Alfredo Gonzalez Caal" });
//       const userB = await t.get("users").insert({ id: "3485128450101", name: "Edin Roberto Ramirez Perez" });
//       const affectedRows = await t.get("users").update({ name: "Kenneth Jhoel Moreno Perez" }, { cui: { eq: "7845674320103"} });
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







######################################################################################################
¿Cómo podría llamar a los niveles de aislamiento de mi base de datos en memoria si cumplen con lo siguiente?:

Aislamiento 1:
- En operaciones de lectura bloquea las filas con shared lock.
- En operaciones de escritura bloquea las filas con exclusive lock.
- Sin MVCC
- Permite ver los datos confirmados mas recientes por otras transacciones.
- Si otro proceso actualiza una fila entre dos consultas dentro de la misma transacción, los datos devueltos reflejarán ese cambio.

Aislamiento 2:
- En operaciones de lectura bloquea las filas con exclusive lock.
- En operaciones de escritura bloquea las filas con exclusive lock.
- Sin MVCC
- Si otra transacción al realizar el commit ingresa nuevas filas o actualiza registros que no esten bloqueados, estas serán visibles.
- Si otro proceso intenta leer o escribir una fila bloqueada, debe esperar hasta que sean liberados por la transacción que los tiene bloqueados (al hacer commit o rollback).


 */
