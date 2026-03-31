
export type UserRole = 'admin' | 'manager' | 'staff';

export interface Profile {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  avatar?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
