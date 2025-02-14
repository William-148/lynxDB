export type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export type ProductDetail = {
  id: number;
  name: string;
  price: number;
  active: boolean;
  tags: string[];
  description: null | string;
  details?: {
    discount: number;
    weight: number;
  }
}