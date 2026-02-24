import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 404,
      message: `Route ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    },
  });
};