import mongoose from 'mongoose';

export async function connectDB() {
  let uri = process.env.MONGO_URI;

  // No database configured locally? Spin up a throwaway in-memory MongoDB.
  if (!uri) {
    if (process.env.NODE_ENV === 'production') throw new Error('MONGO_URI is required in production');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mem = await MongoMemoryServer.create();
    uri = mem.getUri('civiclens');
    console.log('⚠  No MONGO_URI set - using an in-memory database (data resets on restart)');
  }

  await mongoose.connect(uri);
  console.log(`✔ MongoDB connected (${mongoose.connection.name})`);
}
