import 'dotenv/config';
import app from './app.js';
import { connectDB } from './db.js';
import { seedIfEmpty } from './seed.js';

const PORT = process.env.PORT || 5000;

await connectDB();
await seedIfEmpty();
app.listen(PORT, () => console.log(`✔ CivicLens API running on http://localhost:${PORT}`));
