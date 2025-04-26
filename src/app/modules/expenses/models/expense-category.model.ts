export interface ExpenseCategory {
  id?: number;
  name: string;
  color?: string;
  parentId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
} 