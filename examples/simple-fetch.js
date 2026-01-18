/*/ // <package>
{
  dependencies: {
    "node-fetch": "^3.3.0",
    chalk: "^5.3.0"
  }
}
/*/ // </package>

import fetch from 'node-fetch';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue('Fetching data from API...'));

  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    const data = await response.json();

    console.log(chalk.green('\nSuccess!'));
    console.log(chalk.white(JSON.stringify(data, null, 2)));
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

main();
