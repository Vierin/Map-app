/* eslint-disable */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { parse } = path;
const config = require('../gulp-config.json');
const { paths } = config;

const plugins = require('gulp-load-plugins')({
    pattern: [
        'gulp-*',
        'gulp.*',
        'browserify',
        'chalk',
        'del',
        'portfinder',
        'run-sequence',
        'semver',
        'tsify',
        'watchify',
        'yargs',
    ], replaceString: /\bgulp[\-.]/
});


/**
 * Compress images using lovell/sharp
 */
async function imageCompression({silent = false} = {}) {
    /* eslint-disable */
    const inputDir = paths.images.sourceSharp;
    const outputDir = paths.images.dest;
    const { inputFormats, outputFormats } = paths.images;

    const compressionSettings = {
        jpg: { quality: 60, mozjpeg: true },
        png: { quality: 60, compressionLevel: 8, effort: 8 },
        webp: { quality: 70, effort: 5 },
        avif: { quality: 60, chromaSubsampling: '4:2:0', effort: 6 }
    };

    const toPercent = value => `${100 - Math.round(value * 100)}%`;
    const bytesToMegaBytes = size => Math.floor(size / (1024 ** 2) * 100) / 100;

    const getPaths = (dirPath, imagePaths, formats = inputFormats) => {

        imagePaths = imagePaths || [];
        const filePaths = fs.readdirSync(dirPath, { withFileTypes: true });

        filePaths.forEach(filePath => {

            const fileName = parse(filePath.name).base;
            const fileExt = parse(filePath.name).ext;

            if (filePath.isDirectory()) {
                const outputPath = `${dirPath.replace(inputDir, outputDir)}/${fileName}`;
                if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath);
                imagePaths = getPaths(`${dirPath}/${fileName}`, imagePaths);
            } else if (formats.includes(fileExt)) {
                imagePaths.push(`${dirPath}/${fileName}`);
            }
        });
        return imagePaths;
    };


    const getMetadata = async(filePath) => await sharp(filePath).metadata();

    const jpg = async (filePath, outputPath) => {
        await sharp(filePath)
            .jpeg(compressionSettings.jpg)
            .toFile(outputPath);
    };

    const png = async (filePath, outputPath) => {
        await sharp(filePath)
            .png(compressionSettings.png)
            .toFile(outputPath);
    };

    const webp = async (filePath, extension, outputPath) => {
        await sharp(filePath)
            .toFormat('webp')
            .webp(compressionSettings.webp)
            .toFile(outputPath.replace(extension, '.webp'));
    };

    const avif = async (filePath, extension, outputPath) => {
        await sharp(filePath)
            .toFormat('avif')
            .avif(compressionSettings.avif)
            .toFile(outputPath.replace(extension, '.avif'));
    };


    async function runJPG(filePath) {
        const outputPath = filePath.replace(inputDir, outputDir);
        return Promise.all([
            jpg(filePath, outputPath),
            webp(filePath, '.jpg', outputPath),
            avif(filePath, '.jpg', outputPath)
        ]);
    }

    async function runPNG(filePath) {
        const outputPath = filePath.replace(inputDir, outputDir);
        return Promise.all([
            png(filePath, outputPath),
            webp(filePath, '.png', outputPath),
            avif(filePath, '.png', outputPath)
        ]);
    }


    async function processImages(filePaths) {
        if (!silent) console.log('Image Compression starting up!');
        const startTime = Date.now();
        for (const filePath of filePaths) {

            if (!fs.existsSync(filePath.replace(inputDir, outputDir))) {
                if (!silent) console.log(`Image Compression: processing ${filePath}`);
                const fileSizeMb = bytesToMegaBytes(fs.statSync(filePath).size);
                const { width, height } = await getMetadata(filePath);
                // even if silent
                if (width > 2800) console.log('\x1b[33m%s\x1b[0m', `WARNING!: Image ${filePath} exceeds the recommended 2800px limit at ${width}px \n please reference readme.md for guidance`);
                if (height > 2800) console.log('\x1b[33m%s\x1b[0m', `WARNING!: Image ${filePath} exceeds the recommended 2800px limit at ${height}px \n please reference readme.md for guidance`);
                if (fileSizeMb > 3) console.log('\x1b[33m%s\x1b[0m', `WARNING!: Image ${filePath} exceeds the recommended 3MB limit at ${fileSizeMb}MB \n please reference readme.md for guidance`);

                const extension = path.extname(filePath);
                if (extension === '.jpg') await runJPG(filePath);
                else await runPNG(filePath);
            }
        }

        const endTime = Date.now();
        return endTime - startTime;
    }


    async function compressionRatio(inputPaths, outputPaths) {
        const inputSizes = { jpg: 0, png: 0 };
        const outputSizes = { jpg: 0, png: 0, webp: 0, avif: 0 };
        async function sumSizes(sizes, paths) {
            for (const key in sizes) {
                sizes[key] = paths.filter(path => parse(path).ext === `.${key}`)
                    .map(file => !fs.statSync(file).size ? 0 : fs.statSync(file).size)
                    .reduce((prev, current) => prev + current, 0);
            }
        }

        await sumSizes(inputSizes, inputPaths);
        await sumSizes(outputSizes, outputPaths);

        const compressionStats = {
            jpg: inputSizes.jpg ? toPercent(outputSizes.jpg / inputSizes.jpg) : 'no jpgs',
            png: inputSizes.png ? toPercent(outputSizes.png / inputSizes.png) : 'no pngs',
            webp: toPercent(outputSizes.webp / (inputSizes.png + inputSizes.jpg)),
            avif: toPercent(outputSizes.avif / (inputSizes.png + inputSizes.jpg))
        };

        if (!silent) console.log('Image Compression: file sizes reduced by: ', compressionStats);
        // return compressionStats
    }


    async function runCompression() {
        const pathsToProcess = getPaths(inputDir);

        await processImages(pathsToProcess).then(time => {
            if (!silent) console.log(`Image Compression: all files processed in ${time}ms`);
            compressionRatio(getPaths(inputDir), getPaths(outputDir, [], outputFormats));
        }).catch(error => console.log(error));
    }

    /* eslint-enable */

    if (!fs.existsSync(paths.images.dest)) fs.mkdirSync(paths.images.dest);

    return await runCompression() && plugins.notify('Image compression finished!');
}

module.exports = imageCompression;
