import { compileQuery } from "../../../src/core/query/compiler";
import { ProductDetail } from "../../types/product-test.type";
import { User } from "../../types/user-test.type";
import {
  ComparisonCompiledQuery,
  ComparisonOp,
  CompiledQuery,
  LogicalCompiledQuery,
  LogicalOp,
  OpeartorType,
  Query
} from "../../../src/types/query.type";

function createCompCompiled<T>(
  field: keyof T,
  operator: keyof typeof ComparisonOp,
  operand: any
): ComparisonCompiledQuery<T> {
  return {
    type: OpeartorType.Comparison,
    field,
    operator: operator as ComparisonOp,
    operand
  };
}

function createLogicCompiled<T>(
  operator: LogicalOp,
  expressions: CompiledQuery<T>[]
): LogicalCompiledQuery<T> {
  return {
    type: OpeartorType.Logical,
    operator,
    expressions
  };
}

describe("Query Compile", () => {

  it("should compile a simple query", () => {
    const query: Query<User> = {
      fullName: { $like: /^.*hola$/i },
    };
    const compiledExpected = createCompCompiled('fullName', '$like', /^.*hola$/i);

    expect(compileQuery(query)).toEqual(compiledExpected);
  });

  it("should return null if query is empty", () => {
    const emptyQuery: Query<User> = {};
    const compiled = compileQuery(emptyQuery);

    expect(compiled).toBeNull();
  });

  it("should compile query with empty field comparison correctly", () => {
    const query: Query<User> = {
      fullName: {}
    }

    expect(compileQuery(query)).toEqual(createCompCompiled('fullName', '$eq', {}));
  });

  it("should compile query with many empty fields comparison correctly", () => {
    const query: Query<User> = {
      fullName: {},
      age: {},
      id: {}
    }

    const compiledExpected = createLogicCompiled<User>(
      LogicalOp.$and,
      [
        createCompCompiled('fullName', '$eq', {}),
        createCompCompiled('age', '$eq', {}),
        createCompCompiled('id', '$eq', {})
      ]
    );

    expect(compileQuery(query)).toEqual(compiledExpected);
  });

  describe("Logical Operators", () => {

    it("should compile a query with implicit '$and'", () => {
      const query: Query<User> = {
        id: 5,
        fullName: { $like: "%hola" },
        age: { $gt: 25 },
        gender: { $eq: "Female" }
      };
      const compiledExpected = createLogicCompiled<User>(
        LogicalOp.$and,
        [
          createCompCompiled('id', '$eq', 5),
          createCompCompiled('fullName', '$like', /^.*hola$/i),
          createCompCompiled('age', '$gt', 25),
          createCompCompiled('gender', '$eq', "Female")
        ]
      );

      expect(compileQuery(query)).toEqual(compiledExpected);
    });

    it("should throw an error when '$not' query is empty", () => {
      let query;
      const tryToCreate = () => {
        query = compileQuery<User>({
          $not: {}
        });
      }

      expect(tryToCreate).toThrow(/Invalid value for logical operator.*/);
    });

    it("should compile a query with nested '$and' and '$or' operators", () => {
      const query: Query<User> = {
        id: 100,
        fullName: { $like: "%some value%" },
        age: { $gt: 18, $lt: 60 },
        $or: [
          { email: { $in: ["john@example.com", "jane@example.com"] } },
          { id: { $lt: 10, $gte: 2 } },
          {
            $and: [
              { fullName: { $like: "John%" } },
              { age: { $gte: 30, $lte: 35 } }
            ]
          }
        ]
      };

      const expectedCompiled = createLogicCompiled<User>(
        LogicalOp.$and,
        [
          createCompCompiled('id', '$eq', 100),
          createCompCompiled('fullName', '$like', /^.*some value.*$/i),
          createLogicCompiled(
            LogicalOp.$and,
            [
              createCompCompiled('age', '$gt', 18),
              createCompCompiled('age', '$lt', 60)
            ]
          ),
          createLogicCompiled(
            LogicalOp.$or,
            [
              createCompCompiled('email', '$in', new Set(["john@example.com", "jane@example.com"])),
              createLogicCompiled(
                LogicalOp.$and,
                [
                  createCompCompiled('id', '$lt', 10),
                  createCompCompiled('id', '$gte', 2)
                ]
              ),
              createLogicCompiled(
                LogicalOp.$and,
                [
                  createCompCompiled('fullName', '$like', /^John.*$/i),
                  createLogicCompiled(
                    LogicalOp.$and,
                    [
                      createCompCompiled('age', '$gte', 30),
                      createCompCompiled('age', '$lte', 35)
                    ]
                  ),
                ]
              )
            ]
          )
        ]
      );

      expect(compileQuery(query)).toEqual(expectedCompiled);
    });

    it("should compile query with only '$not' operator", () => {
      const query1: Query<ProductDetail> = {
        $not: { id: 10 }
      }

      const query2: Query<ProductDetail> = {
        $not: { id: 10, name: "product", description: { $like: "%tech%" } }
      }

      expect(compileQuery(query1)).toEqual(createLogicCompiled<ProductDetail>(
        LogicalOp.$not,
        [createCompCompiled('id', '$eq', 10)]
      ));

      expect(compileQuery(query2)).toEqual(createLogicCompiled<ProductDetail>(
        LogicalOp.$not,
        [createLogicCompiled(
          LogicalOp.$and,
          [
            createCompCompiled('id', '$eq', 10),
            createCompCompiled('name', '$eq', "product"),
            createCompCompiled('description', '$like', /^.*tech.*$/i)
          ]
        )]
      ));
    });

    it("should compile a nested query with implicit '$and' and explicit '$or' correctly", () => {
      const query: Query<User> = {
        gender: 'Male',
        $or: [
          { username: 'max13', fullName: 'maxim' },
          { username: 'maxim', fullName: 'max13' }
        ]
      }

      const expectedCompiled = createLogicCompiled<User>(
        LogicalOp.$and,
        [
          createCompCompiled('gender', '$eq', 'Male'),
          createLogicCompiled(
            LogicalOp.$or,
            [
              createLogicCompiled(
                LogicalOp.$and,
                [
                  createCompCompiled('username', '$eq', 'max13'),
                  createCompCompiled('fullName', '$eq', 'maxim')
                ]
              ),
              createLogicCompiled(
                LogicalOp.$and,
                [
                  createCompCompiled('username', '$eq', 'maxim'),
                  createCompCompiled('fullName', '$eq', 'max13')
                ]
              )
            ]
          )
        ]
      );

      expect(compileQuery(query)).toEqual(expectedCompiled);
    });

    it("should compile a query with equal default operator", () => {
      const query: Query<ProductDetail> = {
        id: 10,
        details: { discount: 5, weight: 10 },
        tags: ["tag1", "tag2"],
        $or: [
          { details: { $eq: { discount: 10, weight: 20 } } },
          { description: null },
          { description: undefined },
          { description: {} },
          { description: "hola" },
          { name: {} },
          { name: { $like: /^\+?[1-9]\d{1,14}$/ } },
          { name: { $like: "%product%" } },
          { active: true },
        ]
      }

      const expectedCompiled = createLogicCompiled<ProductDetail>(
        LogicalOp.$and,
        [
          createCompCompiled('id', '$eq', 10),
          createCompCompiled('details', '$eq', { discount: 5, weight: 10 }),
          createCompCompiled('tags', '$eq', ["tag1", "tag2"]),
          createLogicCompiled(
            LogicalOp.$or,
            [
              createCompCompiled('details', '$eq', { discount: 10, weight: 20 }),
              createCompCompiled('description', '$eq', null),
              createCompCompiled('description', '$eq', undefined),
              createCompCompiled('description', '$eq', {}),
              createCompCompiled('description', '$eq', "hola"),
              createCompCompiled('name', '$eq', {}),
              createCompCompiled('name', '$like', /^\+?[1-9]\d{1,14}$/),
              createCompCompiled('name', '$like', /^.*product.*$/i),
              createCompCompiled('active', '$eq', true),
            ]
          )
        ]
      );

      expect(compileQuery(query)).toEqual(expectedCompiled);
    });

    it("should compile complex query with mixed logical operators and empty conditions correctly", () => {
      const query: Query<ProductDetail> = {
        $or: [
          { id: 54, },
          {},
          {
            $and: [
              { name: { $like: "%hola" } },
              {}, {}, {}, {},
              {
                $or: [
                  {}, {}, {}, {},
                  { description: null },
                  {}, {}, {}, {},
                  { description: "hola" },
                  {}, {}
                ]
              }
            ]
          },
          {},
          {
            $or: [
              {}, {}, {}, {},
              { description: null }
            ]
          }
        ]
      }

      const expectedCompiled = createLogicCompiled<ProductDetail>(
        LogicalOp.$or,
        [
          createCompCompiled('id', '$eq', 54),
          createLogicCompiled(
            LogicalOp.$and, 
            [
              createCompCompiled('name', '$like', /^.*hola$/i),
              createLogicCompiled(
                LogicalOp.$or, 
                [
                  createCompCompiled('description', '$eq', null),
                  createCompCompiled('description', '$eq', "hola")
                ]
              )
            ]
          ),
          createLogicCompiled(
            LogicalOp.$or, 
            [
              createCompCompiled('description', '$eq', null)
            ]
          )
        ]
      );

      expect(compileQuery(query)).toEqual(expectedCompiled);
    });

    it("should compile a deep nested logical operators", async () => {
      const query: Query<ProductDetail> = {
        $and: [{ $or: [{ $and: [{ $or: [{ $and: [{ id: 400 }] }] }] }] }],
        $or: [{ $and: [{ $or: [{ $and: [{ $or: [{ details: { discount: 200, weight: 500 } }] }] }] }] }],
        $not: { $or: [{ $and: [{ $or: [{ $and: [{ $or: [{ tags: { $eq: ["tag1", "tag2"] } }] }] }] }] }] },
      }

      const expectedCompiled = createLogicCompiled<ProductDetail>(
        LogicalOp.$and,
        [
          createLogicCompiled(LogicalOp.$and, [
            createLogicCompiled(LogicalOp.$or, [
              createLogicCompiled(LogicalOp.$and, [
                createLogicCompiled(LogicalOp.$or, [
                  createLogicCompiled(LogicalOp.$and, [
                    createCompCompiled('id', '$eq', 400)
                  ])
                ])
              ])
            ])
          ]),
          createLogicCompiled(LogicalOp.$or, [
            createLogicCompiled(LogicalOp.$and, [
              createLogicCompiled(LogicalOp.$or, [
                createLogicCompiled(LogicalOp.$and, [
                  createLogicCompiled(LogicalOp.$or, [
                    createCompCompiled('details', '$eq', { discount: 200, weight: 500 })
                  ])
                ])
              ])
            ])
          ]),
          createLogicCompiled(LogicalOp.$not, [
            createLogicCompiled(LogicalOp.$or, [
              createLogicCompiled(LogicalOp.$and, [
                createLogicCompiled(LogicalOp.$or, [
                  createLogicCompiled(LogicalOp.$and, [
                    createLogicCompiled(LogicalOp.$or, [
                      createCompCompiled('tags', '$eq', ["tag1", "tag2"])
                    ])
                  ])
                ])
              ])
            ])
          ])
        ]
      );

      expect(compileQuery(query)).toEqual(expectedCompiled);
    });

  });

});