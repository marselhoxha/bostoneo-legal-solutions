export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
} 