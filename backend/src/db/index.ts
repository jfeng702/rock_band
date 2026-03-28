// db.js
import mongoose from 'mongoose';

const uri =
  process.env.MONGO_URI ||
  'mongodb+srv://<username>:<password>@cluster0.mongodb.net/rockband?retryWrites=true&w=majority';

export async function connectDB() {
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    throw err; // optionally rethrow
  }
}
