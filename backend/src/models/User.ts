import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  socketId: string;
  connectedAt: Date;
  ip: string;
  userAgent: string;
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
  zip?: string;
}

const userSchema: Schema<IUser> = new Schema(
  {
    socketId: { type: String, required: true, unique: true },
    connectedAt: { type: Date },
    ip: { type: String, index: true },
    userAgent: { type: String },
    city: { type: String },
    region: { type: String },
    country: { type: String },
    zip: { type: String },
    isp: { type: String },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>('User', userSchema);
