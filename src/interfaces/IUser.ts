import { UserRole } from "@/types/enums";
import { DatabaseRow } from "@/types/common";

export interface IUser extends DatabaseRow {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department?: string;
  phone?: string;
  is_active: boolean;
  last_login?: Date;
  refresh_token?: string;
}

export interface IUserCreate {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department?: string;
  phone?: string;
}

export interface IUserUpdate {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  department?: string;
  phone?: string;
  is_active?: boolean;
}

export interface IUserProfile
  extends Omit<IUser, "password" | "refresh_token"> {
  full_name?: string;
}

export interface IUserStats {
  total_users: number;
  active_users: number;
  users_by_role: Array<{
    role: UserRole;
    count: number;
  }>;
  recent_logins: number;
}
