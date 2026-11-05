export interface Profile {
  showLastSeen?: boolean;
  id: number;
  firstname: string | null;
  lastname: string | null;
  address: string | null;
  avatarId?: string | null;
}

export interface User {
  id: number;
  email: string | null;
  phoneNumber?: string | null;
  role?: "USER" | "ADMIN";
  profile: Profile | null;
}

export interface ApiResponse<T> {
  statusCode?: number;
  status?: number;
  message: string;
  data: T;
}

export function displayName(user: User | null | undefined) {
  return (
    [user?.profile?.firstname, user?.profile?.lastname]
      .filter(Boolean)
      .join(" ") ||
    user?.email ||
    user?.phoneNumber ||
    "User"
  );
}
