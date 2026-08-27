import { Types } from "mongoose";
import { IUser } from "../models/User.model";

// The ONE shape req.user takes (Slice 1 unified auth, decision D3):
// requireAuth verifies the Bearer access token and attaches this.

export type SessionUser = Pick<IUser, "name" | "email" | "role"> & {
  _id: Types.ObjectId;
};

// Declaration merging: teach Express that req.user exists on Request.
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
