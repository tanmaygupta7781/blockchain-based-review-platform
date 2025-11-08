import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRouter from './routes/api.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || '';
const SKIP_MONGO = process.env.SKIP_MONGO === 'true';
if (!SKIP_MONGO && MONGO_URI) {
  mongoose.connect(MONGO_URI).catch((e) => console.error('Mongo connect error', e));
} else {
  console.log('Skipping Mongo connection');
}

app.use('/api', apiRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});


