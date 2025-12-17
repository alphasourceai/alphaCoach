import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload.js';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use('/upload-resume', upload.single('resume'), uploadRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
