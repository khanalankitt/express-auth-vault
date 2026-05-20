import { Request, Response } from "express";

import { UnauthorizedError } from "../../utils/AppError";
import authService from "./auth.service";

class AuthController {
  register = async (req: Request, res: Response) => {
    const user = await authService.register(req.body);
    res.status(201).json({ user });
  };

  login = async (req: Request, res: Response) => {
    const result = await authService.login(req.body, res);
    res.status(200).json(result);
  };

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token;
    if (!token) throw new UnauthorizedError("Refresh token missing");

    const result = await authService.refresh(token, res);
    res.status(200).json(result);
  };

  forgotPassword = async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body);
    // Same response whether the email exists or not — prevents user enumeration.
    res
      .status(200)
      .json({ message: "If this email exists, a reset link has been sent" });
  };

  resetPassword = async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    res.status(200).json({ message: "Password reset successful" });
  };

  logout = async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token;
    if (!token) throw new UnauthorizedError("Refresh token missing");

    await authService.logout(token, res);
    res.status(200).json({ message: "Logged out successfully" });
  };

  me = async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    const user = await authService.getCurrentUser(req.user.userId);
    res.status(200).json({ user });
  };
}

export default new AuthController();
