export type LoginRequestData = {
  email: string;
  password: string;
};

export type RegisterRequestData = {
  username: string;
  email: string;
  password: string;
};

export type ForgotPasswordRequestData = {
  email: string;
};

export type ResetPasswordRequestData = {
  token: string;
  newPassword: string;
};

export type AuthUserPayload = {
  id: string;
  email: string;
  username: string;
};

export type JwtPayload = {
  userId: string;
  email: string;
  username: string;
};