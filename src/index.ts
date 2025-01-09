import { Table } from "./core/table";
import { User } from "../tests/types/user-test.type";
import { mockUsers } from "../tests/data/registers.db";
import { thirtyItemsUserList } from "../tests/data/data-test";

const test = async () => {
  const userTb = new Table<User>('user', []);
  const userB = new Table<User>('user', ['id']);
  try {

    await userTb.bulkInsert(mockUsers);
    await userB.bulkInsert(thirtyItemsUserList);

    // const finded = await userTb.findByPk({ id: 100 });
    // console.table(finded);
    // return;
    console.table(await userB.select([], {} ));

    const result = await userTb.select(
      [],
      {
        id: { gte: 200, lte: 322 },
        email: { like: '%mun%' }
      }
    );
    console.table(result);

    const loginResult = await userTb.select([], {
      email: { eq: 'ischaferu@youtube.com' },
      password: { eq: 'jT0}NSmJs!\\\"l,(' }
    });
    console.table(loginResult);

    const findWithLikeResult = await userTb.select(["email", "password"], {
      fullName: { like: '%jef%' }
    });
    console.table(findWithLikeResult);

  } catch (error) {
    console.error(error)
  }
}
test();
