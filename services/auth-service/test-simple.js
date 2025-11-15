// Minimal Express test
import express from 'express';

const app = express();
app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Test endpoint works' });
});

app.listen(4002, () => {
  console.log('Test server on port 4002');
});
