/*/ // <package>
{
  dependencies: {
    chalk: "^5.3.0"
  }
}
/*/ // </package>

import chalk from 'chalk';

interface Greeting {
  message: string;
  recipient: string;
}

function greet(greeting: Greeting): void {
  console.log(chalk.green(`${greeting.message}, ${greeting.recipient}!`));
}

const greeting: Greeting = {
  message: "Hello from TypeScript",
  recipient: "UV/UVX",
};

greet(greeting);

console.log(chalk.blue('✓ TypeScript works!'));
console.log(chalk.yellow('✓ Types checked!'));
console.log(chalk.magenta('✓ Inline dependencies loaded!'));
