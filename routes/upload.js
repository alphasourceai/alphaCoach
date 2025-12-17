import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No resume uploaded.');
    }

    // Placeholder logic
    console.log(`Received file: ${req.file.originalname}`);
    res.status(200).send('Resume uploaded successfully.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error uploading resume.');
  }
});

export default router;
