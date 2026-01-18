/*/ // <package>
{
  dependencies: {
    express: "^4.18.0",
    chalk: "^5.3.0"
  }
}
/*/ // </package>

import express from 'express';
import chalk from 'chalk';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(chalk.green(`Server running at http://localhost:${port}`));
  console.log(chalk.blue('This was started with inline dependencies!'));
  console.log(chalk.yellow('Press Ctrl+C to stop'));
});
