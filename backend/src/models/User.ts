import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  socketId: string;
  connectedAt: Date;
  ip: string;
  userAgent: string;
}

const userSchema: Schema<IUser> = new Schema(
  {
    socketId: { type: String, required: true, unique: true },
    connectedAt: { type: Date },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>('User', userSchema);
