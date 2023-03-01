#!/usr/bin/env node
const fs = require('fs');

console.log('Checking media sizes pre-commit...');

const MAX_SIZE = 5000000;
const directory = 'dist/media';
const filePaths = fs.readdirSync(directory, { withFileTypes: true });

filePaths.forEach(path => {
    const fileSize = fs.statSync(`${directory}/${path.name}`).size;
    if (fileSize > MAX_SIZE) {
        console.log(`Maximum file size exceeded at ${fileSize} in ${path.name}  - cannot commit.`);
        process.exit(1);
    }
});

process.exit(0);
