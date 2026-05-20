import { NextFunction, Request, RequestHandler, Response } from "express";

export const validate =
  <T>(validator: (body: unknown) => T): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = validator(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
