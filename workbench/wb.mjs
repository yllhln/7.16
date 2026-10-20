#!/usr/bin/env node
import { run } from './commands/cli.mjs';
process.exitCode = await run();
