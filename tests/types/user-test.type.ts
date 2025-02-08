export type User = {
  id: number;
  fullName: string;
  gender: "Male" | "Female";
  age: number;
  email: string;
  username: string;
  password: string;
}

export type PersonInfo = {
  id: number;
  name: string;
  age: number;
  active: boolean;
  tags: string[];
};

/**
 * Here we have a list of properties that are present in the User type.
 */
export const userPropertyList: (keyof User)[] = [
  "id", 
  "fullName", 
  "gender", 
  "age", 
  "email", 
  "username", 
  "password"
];