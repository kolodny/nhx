/*/ // <package>
{
  dependencies: {
    "fs-extra": "^11.2.0",
    chalk: "^5.3.0"
  }
}
/*/ // </package>


import fs from 'fs-extra';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log(chalk.blue('File Operations Example'));

  const testDir = path.join(__dirname, 'temp-test');
  const testFile = path.join(testDir, 'test.txt');

  try {
    // Create directory
    await fs.ensureDir(testDir);
    console.log(chalk.green('✓ Created directory'));

    // Write file
    await fs.writeFile(testFile, 'Hello from nhx!');
    console.log(chalk.green('✓ Wrote file'));

    // Read file
    const content = await fs.readFile(testFile, 'utf-8');
    console.log(chalk.green('✓ Read file:'), chalk.white(content));

    // Clean up
    await fs.remove(testDir);
    console.log(chalk.green('✓ Cleaned up'));

    console.log(chalk.blue('\nAll operations completed successfully!'));
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

main();
