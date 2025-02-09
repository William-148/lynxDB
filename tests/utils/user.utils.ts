import { faker } from '@faker-js/faker';
import { User } from '../types/user-test.type';

export function createRandomUser(defaultId?: number): User {
  return {
    id: defaultId ?? faker.number.int(),
    fullName: faker.person.fullName(),
    gender: faker.person.sexType() === 'male' ? 'Male' : 'Female',
    age: faker.number.int({ min: 18, max: 60 }),
    email: faker.internet.email(),
    username: faker.internet.username(),
    password: faker.internet.password()
  };
}

export function createCompleteUser(partialUser: Partial<User>): User {
  return {
    id: partialUser.id ?? faker.number.int(),
    fullName: partialUser.fullName ?? faker.person.fullName(),
    gender: partialUser.gender ?? faker.person.sexType() === 'male' ? 'Male' : 'Female',
    age: partialUser.age ?? faker.number.int({ min: 18, max: 60 }),
    email: partialUser.email ?? faker.internet.email(),
    username: partialUser.username ?? faker.internet.username(),
    password: partialUser.password ?? faker.internet.password()
  };
}
