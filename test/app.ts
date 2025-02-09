import { IsolationLevel, LynxDB, TablesDefinition } from "../src";

// Types of data that the tables will store
type User = { id: number; name: string; email: string; }
type Post = { id: number; title: string; content: string; ownerId: number; }
type TableList = {
  users: User;
  posts: Post;
}

// Define the configurations for the tables

const tableConfigs: TablesDefinition<{
  users: User;
  posts: Post;
}> = {
  users: {
    primaryKey: ["id"]
  },
  posts: {
    primaryKey: ["id"]
  }
  // More tables configuration...
};

// Crear instancia y configurar de manera global
const db = new LynxDB(tableConfigs, {
  isolationLevel: IsolationLevel.Serializable,
  lockTimeout: 1000
});

// Configurar al crear transacciones
const transaction = db.createTransaction({
  isolationLevel: IsolationLevel.Serializable,
  lockTimeout: 1000
});

db.transaction(async (t) => {
    const users = t.get("users");
    // Perform operations...
  }, 
  {
    isolationLevel: IsolationLevel.Serializable,
    lockTimeout: 1000
  }
);


async function transactionCallbackExample(){
  try {
    const result = await db.transaction(async (t) => {
      const userInserted = await t.get("users").insert({ 
        id: 1, 
        name: 'John Doe', 
        email: 'john.doe@example.com' 
      });
      const updatedCount = await t.get("users").update(
        { email: "doe.john@domain.com" }, 
        { id: { $eq: 1 } }
      );
      // More operations...

      // You can return any value or void
      return { userInserted, updatedCount }
    });

    // After the transaction is completed
    console.log("User Inserted", result.userInserted);
    console.log("Updated count", result.updatedCount);
  }
  catch(error){
    console.error(error);
  }
}

transactionCallbackExample();

try {
  // Perform operations
  const a = transaction.get("users").update({ name: "Jhon Doe" }, { id: { $eq: 1 } });
  // More operations...
  await transaction.commit();
}catch(error){
  transaction.rollback();
}

// Getting tables
const users = db.get("users");
const posts = db.get("posts");

// Perform operations
users.insert({ id: 1 , name: "Jhon Smith", email: "some@domain.com" });
posts.insert({ id: 1, title: "First Post", content: "This is the first post", ownerId: 1 });