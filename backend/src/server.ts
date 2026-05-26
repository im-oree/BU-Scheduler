import app from './app';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // Keep the startup log simple for Render and local development.
  console.log(`BU Scheduler API listening on port ${port}`);
});