import { match } from "../../../src/core/query/matcher";
import { compileQuery } from "../../../src/core/query/compiler";
import { ComparisonCompiledQuery, LogicalCompiledQuery, OpeartorType } from "../../../src/types/query.type";
import { ProductDetail } from "../../types/product-test.type";

const productDetails: ProductDetail[] = [
  { id: 1, name: "Laptop",     price: 1200, active: true, tags: ["electronics", "computers"], description: "High-end laptop", details: { discount: 10, weight: 30 } },
  { id: 2, name: "Smartphone", price:  800, active: true, tags: ["electronics", "phones"], description: "Latest model smartphone", details: { discount: 12, weight: 50 } },
  { id: 3, name: "Book",       price:   20, active: false, tags: ["education", "literature"], description: null, details: { discount: 15, weight: 100 } },
  { id: 4, name: "Coffee Mug", price:   10, active: true, tags: ["kitchen", "accessories"], description: "Ceramic mug", details: { discount: 0, weight: 200 } },
  { id: 5, name: "T-Shirt",    price:   35, active: true, tags: ["clothing"], description: "Cotton T-shirt" },
  { id: 6, name: "Desk Lamp",  price:   45, active: false, tags: ["furniture", "lighting"], description: "LED desk lamp", details: { discount: 7, weight: 40 } },
  { id: 7, name: "Backpack",   price:   60, active: true, tags: ["accessories", "travel"], description: "Waterproof backpack", details: { discount: 50, weight: 35 } },
  { id: 8, name: "Notebook",   price:    5, active: true, tags: ["stationery"], description: "A5 notebook", details: { discount: 5, weight: 300 } },
  { id: 9, name: "Headphones", price:  150, active: true, tags: ["electronics", "audio"], description: "Wireless headphones", details: { discount: 10, weight: 25 } },
  { id: 10, name: "Monitor",   price:  300, active: false, tags: ["electronics", "computers"], description: "27 inch monitor", details: { discount: 30, weight: 12 } }
];

describe("Matcher", () => {

  it("should match 'equal' query", () => {
    const itemTestA = productDetails[4];
    const itemTestB = productDetails[1];
    const itemToNotMatch = productDetails[2];

    const compiledTestA1 = compileQuery<ProductDetail>({
      id: 5, 
      details: undefined
    });
    const compiledTestA2 = compileQuery<ProductDetail>({
      id: { $eq: 5 }, 
      details: { $eq: undefined }
    });

    const compiledTestB1 = compileQuery<ProductDetail>({
      id: 2,
      name: "Smartphone"
    });
    const compiledTestB2 = compileQuery<ProductDetail>({
      id: { $eq: 2 },
      name: { $eq: "Smartphone" }
    });

    expect(match(itemTestA, compiledTestA1)).toBe(true);
    expect(match(itemTestA, compiledTestA2)).toBe(true);
    expect(match(itemToNotMatch, compiledTestA1)).toBe(false);
    expect(match(itemToNotMatch, compiledTestA2)).toBe(false);

    expect(match(itemTestB, compiledTestB1)).toBe(true);
    expect(match(itemTestB, compiledTestB2)).toBe(true);
    expect(match(itemToNotMatch, compiledTestB1)).toBe(false);
    expect(match(itemToNotMatch, compiledTestB2)).toBe(false);
  });

  it("should match 'not equal' query", () => {
    const itemToNotMatchA = productDetails[4];
    const itemToNotMatchB = productDetails[7];
    const itemToMatch = productDetails[2];

    const compiledQueryA = compileQuery<ProductDetail>({
      id: { $ne: 5 }
    });
    const compiledQueryB = compileQuery<ProductDetail>({
      name: { $ne: "Notebook" }
    });

    expect(match(itemToMatch, compiledQueryA)).toBe(true);
    expect(match(itemToMatch, compiledQueryB)).toBe(true);
    expect(match(itemToNotMatchA, compiledQueryA)).toBe(false);
    expect(match(itemToNotMatchB, compiledQueryB)).toBe(false);
  });

  it("should match 'greater than' and 'greater than or equal' query", () => {
    const compiledQueryGt = compileQuery<ProductDetail>({
      price: { $gt: 60 }
    });
    const compiledQueryGte = compileQuery<ProductDetail>({
      price: { $gte: 45 }
    });

    expect(match(productDetails[8]/*price=150*/, compiledQueryGt)).toBe(true);
    expect(match(productDetails[6]/*price=60*/, compiledQueryGt)).toBe(false);
    expect(match(productDetails[5]/*price=45*/, compiledQueryGt)).toBe(false);

    expect(match(productDetails[8]/*price=150*/, compiledQueryGte)).toBe(true);
    expect(match(productDetails[5]/*price=45*/, compiledQueryGte)).toBe(true);
    expect(match(productDetails[7]/*price=5*/, compiledQueryGte)).toBe(false);
  });

  it("should match 'lower than' and 'lower than or equal' query", () => {
    const compiledQueryLt = compileQuery<ProductDetail>({
      price: { $lt: 60 }
    });
    const compiledQueryLte = compileQuery<ProductDetail>({
      price: { $lte: 45 }
    });

    expect(match(productDetails[5]/*price=45*/, compiledQueryLt)).toBe(true);
    expect(match(productDetails[6]/*price=60*/, compiledQueryLt)).toBe(false);
    expect(match(productDetails[8]/*price=150*/, compiledQueryLt)).toBe(false);

    expect(match(productDetails[7]/*price=5*/, compiledQueryLte)).toBe(true);
    expect(match(productDetails[5]/*price=45*/, compiledQueryLte)).toBe(true);
    expect(match(productDetails[8]/*price=150*/, compiledQueryLte)).toBe(false);
  });

  it("should match 'array inclusion' and 'array exclusion' query", () => {
    const inclusionQuery = compileQuery<ProductDetail>({
      name: { $in: ["Laptop", "Smartphone"] }
    });
    const exclusionQuery = compileQuery<ProductDetail>({
      name: { $nin: ["Laptop", "Smartphone"] }
    });

    expect(match(productDetails[0], inclusionQuery)).toBe(true);
    expect(match(productDetails[1], inclusionQuery)).toBe(true);
    expect(match(productDetails[3], inclusionQuery)).toBe(false);

    expect(match(productDetails[0], exclusionQuery)).toBe(false);
    expect(match(productDetails[1], exclusionQuery)).toBe(false);
    expect(match(productDetails[3], exclusionQuery)).toBe(true);
  });

  it("should match 'string pattern match' query", () => {
    const compiledQuery1 = compileQuery<ProductDetail>({
      description: { $like: "latest%" }
    });
    const compiledQuery2 = compileQuery<ProductDetail>({
      description: { $like: "%desk%" }
    });

    expect(match(productDetails[1], compiledQuery1)).toBe(true);
    expect(match(productDetails[2], compiledQuery1)).toBe(false);

    expect(match(productDetails[5], compiledQuery2)).toBe(true);
    expect(match(productDetails[4], compiledQuery2)).toBe(false);
  });

  it("should match and not match a simple query with logical operators", () => {
    const notQuery = compileQuery<ProductDetail>({
      $not: { id: 5 }
    });
    const orQuery = compileQuery<ProductDetail>({
      $or: [
        { id: 1 },
        { name: "Smartphone" }
      ]
    });
    const andQuery = compileQuery<ProductDetail>({
      $and: [
        { id: 3 },
        { active: false }
      ]
    });

    // Not query
    expect(match(productDetails[4], notQuery)).toBe(false);
    expect(match(productDetails[7], notQuery)).toBe(true);
    expect(match(productDetails[2], notQuery)).toBe(true);
    // Or query
    expect(match(productDetails[0], orQuery)).toBe(true);
    expect(match(productDetails[1], orQuery)).toBe(true);
    expect(match(productDetails[3], orQuery)).toBe(false);
    // And query
    expect(match(productDetails[2], andQuery)).toBe(true);
    expect(match(productDetails[5], andQuery)).toBe(false);
  });

  it("should filter records by a range of values", () => {
    const compiledQuery = compileQuery<ProductDetail>({
      $and: [
        { price: { $gt: 40 } },
        { price: { $lt: 300 } }
      ]
    });

    const filterResult = productDetails.filter(item => item.price > 40 && item.price < 300);
    const matchResult = productDetails.filter(item => match(item, compiledQuery));

    expect(matchResult.map(i => i.id)).toEqual(filterResult.map(i => i.id));
  })

  it("should throw an error for unsupported operator", () => {
    const comparisonQuery: ComparisonCompiledQuery<ProductDetail>[] = [{
      type: OpeartorType.Comparison,
      field: 'id',
      operator: '$unknown' as any,
      operand: 5
    }];
    const logicalQuery: LogicalCompiledQuery<ProductDetail>[] = [{
      type: OpeartorType.Logical,
      operator: '$unknown' as any,
      expressions: []
    }];

    expect(() => match(productDetails[0], comparisonQuery)).toThrow("Unsupported operator: $unknown");
    expect(() => match(productDetails[0], logicalQuery)).toThrow("Unsupported operator: $unknown");
  });

  describe("Matching with objects and arrays values", () => {

    it("should match 'equal' query", () => {
      const itemToMatch = productDetails[0];
      const itemToNotMatch = productDetails[4];
      const compiledQueryA1 = compileQuery<ProductDetail>({
        tags: ["electronics", "computers"],
        details: { discount: 10, weight: 30 }
      });
      const compiledQueryA2 = compileQuery<ProductDetail>({
        tags: { $eq: ["electronics", "computers"] },
        details: { $eq: { discount: 10, weight: 30 } }
      });
  
      expect(match(itemToMatch, compiledQueryA1)).toBe(true);
      expect(match(itemToMatch, compiledQueryA2)).toBe(true);
      expect(match(itemToNotMatch, compiledQueryA1)).toBe(false);
      expect(match(itemToNotMatch, compiledQueryA2)).toBe(false);
    });

    it("should match 'not equal' query", () => {
      const itemToNotMatchA = productDetails[9];
      const itemToNotMatchB = productDetails[7];
      const itemToMatch = productDetails[2];
      const compiledQueryA = compileQuery<ProductDetail>({
        tags: { $ne: ["electronics", "computers"] }
      });
      const compiledQueryB = compileQuery<ProductDetail>({
        details: { $ne: { discount: 5, weight: 300 } }
      });
  
      expect(match(itemToMatch, compiledQueryA)).toBe(true);
      expect(match(itemToMatch, compiledQueryB)).toBe(true);
      expect(match(itemToNotMatchA, compiledQueryA)).toBe(false);
      expect(match(itemToNotMatchB, compiledQueryB)).toBe(false);
    });

    it("should match 'array inclusion' and 'array exclusion' query", () => {
      const inclusionQuery = compileQuery<ProductDetail>({
        tags: { $in: ["education", "lighting"] }
      });
      const exclusionQuery = compileQuery<ProductDetail>({
        tags: { $nin: ["education", "lighting"] }
      });
  
      expect(match(productDetails[2], inclusionQuery)).toBe(true);
      expect(match(productDetails[5], inclusionQuery)).toBe(true);
      expect(match(productDetails[0], inclusionQuery)).toBe(false);
      expect(match(productDetails[7], inclusionQuery)).toBe(false);

      expect(match(productDetails[2], exclusionQuery)).toBe(false);
      expect(match(productDetails[5], exclusionQuery)).toBe(false);
      expect(match(productDetails[0], exclusionQuery)).toBe(true);
      expect(match(productDetails[7], exclusionQuery)).toBe(true);

    });

    it("should correctly match products based on complex query conditions", () => {
      const arrayIn = ['kitchen', 'phones', 'electronics', 'stationery'];
      const compiledQuery = compileQuery<ProductDetail>({
        $or: [
          { 
            $and: [ 
              { price: { $gte: 65 } },
              { tags: { $in: arrayIn } }
            ]
          },
          { details: { discount: 50, weight: 35 } }
        ]
      });

      const filterResults = productDetails.filter(item => (
        (item.price >= 65 && arrayIn.some(i => item.tags.includes(i))) || 
        ( item.details?.discount === 50 && item.details.weight === 35 )
      ));
      const matchResults = productDetails.filter(item => match(item, compiledQuery));

      // console.table(filterResults);
      // console.table(matchResults);
      expect(matchResults.map(i => i.id)).toEqual(filterResults.map(i => i.id));
    });
  });

  describe("Matching with unexpected values", () => {

    it("should not match any when '$like' pattern is not a string", async () => {
      const numericLikeValue = compileQuery<ProductDetail>({ name: { $like: 33 as any } });
      const booleanLikeValue = compileQuery<ProductDetail>({ name: { $like: true as any } });
      const nullLikeValue = compileQuery<ProductDetail>({ name: { $like: null as any } });
      const objectLikeValue = compileQuery<ProductDetail>({ name: { $like: { some: 'data' } as any } });
      const stringLikeValue = compileQuery<ProductDetail>({ name: { $like: [] as any } });

      const filterResult = productDetails.filter(item => {
        return match(item, numericLikeValue) 
          || match(item, booleanLikeValue) 
          || match(item, nullLikeValue) 
          || match(item, objectLikeValue) 
          || match(item, stringLikeValue);
      });
      
      expect(filterResult).toHaveLength(0);
    });

    it("should not match any when '$in' operator is not an array", () => {
      const inWithNull = compileQuery<ProductDetail>({ price: { $in: null as any } });
      const inWithUndefined = compileQuery<ProductDetail>({ price: { $in: undefined as any } });
      const inWithNumeric = compileQuery<ProductDetail>({ price: { $in: 234 as any } });
      const inWithString = compileQuery<ProductDetail>({ price: { $in: "1200" as any } });
      const inWithObject = compileQuery<ProductDetail>({ price: { $in: { some: 1200 } as any } });

      const filterResult = productDetails.filter(item => {
        return match(item, inWithNull) 
          || match(item, inWithUndefined) 
          || match(item, inWithNumeric) 
          || match(item, inWithString) 
          || match(item, inWithObject);
      });
      
      expect(filterResult).toHaveLength(0);
    })
  });

});