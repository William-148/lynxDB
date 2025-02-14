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

function expectComparisonCompiled<T>(
  query: CompiledQuery<T>,
  expected: { field: keyof T, operator: ComparisonOp, operand: any }
) {
  expect(query).toEqual({
    type: OpeartorType.Comparison,
    field: expected.field,
    operator: expected.operator,
    operand: expected.operand
  });
}

function expectLogicalCompiled<T>(
  logicalNode: LogicalCompiledQuery<T>,
  expectedOperator: LogicalOp,
  expectedExpressionsCount: number
) {
  expect(logicalNode.type).toBe(OpeartorType.Logical);
  expect(logicalNode.operator).toBe(expectedOperator);
  expect(logicalNode.expressions.length).toBe(expectedExpressionsCount);
}

describe("Query Compile", () => {

  it("should compile a simple query", () => {
    const query: Query<User> = {
      id: 5,
      fullName: { $like: "%hola" },
      age: { $gt: 25, $lt: 50 },
      gender: { $eq: "Female" }
    };
    const compiled = compileQuery(query);
    expect(compiled.length).toBe(5);
    expectComparisonCompiled(compiled[0], { field: 'id', operator: ComparisonOp.$eq, operand: 5 });
    expectComparisonCompiled(compiled[1], { field: 'fullName', operator: ComparisonOp.$like, operand: /^.*hola$/i });
    expectComparisonCompiled(compiled[2], { field: 'age', operator: ComparisonOp.$gt, operand: 25 });
    expectComparisonCompiled(compiled[3], { field: 'age', operator: ComparisonOp.$lt, operand: 50 });
    expectComparisonCompiled(compiled[4], { field: 'gender', operator: ComparisonOp.$eq, operand: 'Female' });
  });

  it("should compile a query with nested logical operators", () => {
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
    const compiled = compileQuery(query);
    expect(compiled.length).toBe(5);
    expectComparisonCompiled(compiled[0], { field: 'id', operator: ComparisonOp.$eq, operand: 100 });
    expectComparisonCompiled(compiled[1], { field: 'fullName', operator: ComparisonOp.$like, operand: /^.*some value.*$/i });
    expectComparisonCompiled(compiled[2], { field: 'age', operator: ComparisonOp.$gt, operand: 18 });
    expectComparisonCompiled(compiled[3], { field: 'age', operator: ComparisonOp.$lt, operand: 60 });
    // $or
    const orNode = compiled[4] as LogicalCompiledQuery<User>;
    expectLogicalCompiled(orNode, LogicalOp.$or, 4);
    const [exprEmain, exprIdLt, exprIdGte, exprAnd] = orNode.expressions;
    expectComparisonCompiled(exprEmain, { field: 'email', operator: ComparisonOp.$in, operand: new Set(["john@example.com", "jane@example.com"]) });
    expectComparisonCompiled(exprIdLt, { field: 'id', operator: ComparisonOp.$lt, operand: 10 });
    expectComparisonCompiled(exprIdGte, { field: 'id', operator: ComparisonOp.$gte, operand: 2 });

    // sub operator $and
    const andSubNode = exprAnd as LogicalCompiledQuery<User>;
    expectLogicalCompiled(andSubNode, LogicalOp.$and, 3);
    const [exprFullName, exprAgeGte, exprAgeLte] = andSubNode.expressions;
    expectComparisonCompiled(exprFullName, { field: 'fullName', operator: ComparisonOp.$like, operand: /^John.*$/i });
    expectComparisonCompiled(exprAgeGte, { field: 'age', operator: ComparisonOp.$gte, operand: 30 });
    expectComparisonCompiled(exprAgeLte, { field: 'age', operator: ComparisonOp.$lte, operand: 35 });
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
        { description: "hola" },
        { name: { $like: "%product%" } },
        { active: true },
      ]
    }

    const compiled = compileQuery(query);
    expect(compiled.length).toBe(4);
    expectComparisonCompiled(compiled[0], { field: 'id', operator: ComparisonOp.$eq, operand: 10 });
    expectComparisonCompiled(compiled[1], { field: 'details', operator: ComparisonOp.$eq, operand: { discount: 5, weight: 10 } });
    expectComparisonCompiled(compiled[2], { field: 'tags', operator: ComparisonOp.$eq, operand: ["tag1", "tag2"] });
    // $or
    const orNode = compiled[3] as LogicalCompiledQuery<ProductDetail>;
    expectLogicalCompiled(orNode, LogicalOp.$or, 6);
    expectComparisonCompiled(orNode.expressions[0], { field: 'details', operator: ComparisonOp.$eq, operand: { discount: 10, weight: 20 } });
    expectComparisonCompiled(orNode.expressions[1], { field: 'description', operator: ComparisonOp.$eq, operand: null });
    expectComparisonCompiled(orNode.expressions[2], { field: 'description', operator: ComparisonOp.$eq, operand: undefined });
    expectComparisonCompiled(orNode.expressions[3], { field: 'description', operator: ComparisonOp.$eq, operand: "hola" });
    expectComparisonCompiled(orNode.expressions[4], { field: 'name', operator: ComparisonOp.$like, operand: /^.*product.*$/i });
    expectComparisonCompiled(orNode.expressions[5], { field: 'active', operator: ComparisonOp.$eq, operand: true });
  });

  it("should compile a deep nested logical operators", async () => {
    const comparison = OpeartorType.Comparison;
    const query1: Query<ProductDetail> = {
      $and: [{ $or: [{ $and: [{ $or: [{ $and: [{ id: 400 }] }] }] }] }],
      $or: [{ $and: [{ $or: [{ $and: [{ $or: [{ details: { discount: 200, weight: 500 } }] }] }] }] }],
      $not: { $or: [{ $and: [{ $or: [{ $and: [{ $or: [{ tags: { $eq: ["tag1", "tag2"] } }] }] }] }] }] },
    }
    const expectedResults = [
      [["$and", "$or", "$and", "$or", "$and"], { type: comparison, field: 'id', operator: '$eq', operand: 400 }],
      [["$or", "$and", "$or", "$and", "$or"], { type: comparison, field: 'details', operator: '$eq', operand: { discount: 200, weight: 500 } }],
      [["$not", "$or", "$and", "$or", "$and", "$or"], { type: comparison, field: 'tags', operator: '$eq', operand: ['tag1', 'tag2'] }]
    ];
    const deepTrace = (compiled: CompiledQuery<ProductDetail>, operatorList: string[]): ComparisonCompiledQuery<ProductDetail> | undefined => {
      if (compiled.type === OpeartorType.Logical) {
        operatorList.push(compiled.operator);
        for (const exp of compiled.expressions) {
          const result = deepTrace(exp, operatorList);
          if (result) return result;
        }
      }
      else {
        return compiled;
      }
    }

    const compiled = compileQuery(query1);

    await Promise.all(compiled.map((query, index) => {
      const trace: string[] = [];
      const comparisonCompiled = deepTrace(query, trace);

      const [expectedTrace, expectedCompiled] = expectedResults[index];
      expect(comparisonCompiled).toEqual(expectedCompiled)
      expect(trace).toEqual(expectedTrace);
    }));
  });
});