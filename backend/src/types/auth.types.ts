import { Types } from "mongoose";
import { IUser } from "../models/User.model";

// The two shapes req.user can take — a documented wart (see CLAUDE.md's
// "Two auth mechanisms" note). Cookie auth attaches a SessionUser;
// Bearer auth attaches just the user id string. Slice 1's auth refactor
// unifies this; until then the types keep the duality visible and safe.

export type SessionUser = Pick<IUser, "name" | "email" | "role"> & {
  _id: Types.ObjectId;
};

export type BearerUserId = string;

// Declaration merging: teach Express that req.user exists on Request.
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser | BearerUserId;
    }
  }
}
