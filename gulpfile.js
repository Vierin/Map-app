const gulp = require('gulp');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const { parse } = path;


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

const browserSync = require('browser-sync').create();
const autoClose = require('browser-sync-close-hook');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const log = require('fancy-log');
const validator = require('html-validator');

const args = plugins.yargs.argv;
const config = require('./gulp-config.json');
const params = require('./package.json');


const { paths } = config;

const imageCompression = require('./gulp/imageCompression.js');
const test = require('./gulp/test.js');
const { svgMinify, svgNoMinify, svgStore, insertSVGs } = require('./gulp/svg.js');


/**
 * Set library defaults
 */
axios.defaults.maxRedirects = 20;

/**
 * Clean the build by removing files/directories
 */
function clean() {
    return plugins.del(
        [
            `${paths.html.dest}/index.html`,
            paths.sass.dest,
            paths.scripts.dest,
        ],
        { force: true }
    );
}

/**
 * Compile the styles for the build
 */
function styles() {
    return (
        gulp
            .src(paths.sass.main)
            .pipe(plugins.if(!args.release, plugins.header(':root { --status: "development"; }\n')))
            .pipe(plugins.if(!args.release, plugins.sourcemaps.init()))
            .pipe(plugins.sass({ outputStyle: 'compressed' })
                .on('error', plugins.sass.logError))
            .pipe(plugins.autoprefixer({ remove: false }))
            // purify css only on --test
            .pipe(plugins.if(!!args.test, plugins.purifycss([
                `${paths.scripts.dest + paths.scripts.file}`,
                `${paths.html.dest}/*.html`
            ], {
                minify: true,
                rejected: true,
                info: true,
            })))
            .pipe(plugins.if(!args.release, plugins.sourcemaps.write()))
            .pipe(plugins.size())
            .pipe(gulp.dest(paths.sass.dest))
            .pipe(browserSync.stream())
            .pipe(plugins.notify('Styles ready!'))
    );
}

/**
 * Add in any script libraries needed for the build
 */
function libs() {
    const files = paths.scripts.libs.concat(paths.scripts.plugins);

    return gulp
        .src(files)
        .pipe(plugins.if(!!args.release, plugins.size({ showFiles: true })))
        .pipe(plugins.expectFile(files))
        .pipe(plugins.concat('libs.js'))
        .pipe(plugins.terser())
        .pipe(gulp.dest(paths.scripts.dest))
        .pipe(plugins.notify('Libs ready!'));
}

/**
 * Remove the images from the build
 */
function cleanImages() {
    return plugins.del([paths.images.dest], { force: true });
}

/**
 * Delete images: an utility function for imageWatcher
 */
function deleteImages(srcPath, changed = false) {
    console.log(`${srcPath} was ${changed ? 'replaced' : 'deleted'}`);
    const distPath = srcPath.replace(paths.images.sourceSharp, paths.images.dest);
    if (fs.existsSync(distPath) && parse(distPath).ext) {
        paths.images.outputFormats.forEach(fileFormat => {
            const outputPath = distPath.replace(parse(distPath).ext, fileFormat);
            fs.existsSync(outputPath) && fs.unlinkSync(outputPath);
        });
    }
}

// validate html

async function validateHTML() {

    const files = paths.html.targets.map(t => `${paths.html.dest}/${t}.html`);
    return Promise.all(
        files.map(async file => {
            const html = fs.readFileSync(file, 'utf8');
            const options = {
                data: html,
                format: 'text',
            };

            try {
                const result = await validator(options);
                const lines = result.split(/\n/);

                for (let index = 0; index < lines.length; index++) {
                    const line = lines[index];
                    if (line.indexOf('Unclosed') >= 0) {
                        const lNum = /From line (\d+),/gmi.exec(lines[index + 1])[1];
                        console.log(`${plugins.chalk.underline.yellow(`${file}:${lNum}`)} ${plugins.chalk.red(line)}`);
                    }
                }

                return Promise.resolve();

            } catch (error) {
                console.error(error);
                return Promise.reject();
            }
        })
    );
}

/**
 * Copy images from images-compressed to media
 */
function copyCompressed() {
    return gulp
        .src(paths.images.compressed)
        .pipe(plugins.newer(paths.images.dest))
        .pipe(gulp.dest(paths.images.dest))
        .pipe(
            plugins.notify({
                message: 'Manually compressed files copied!',
                onLast: true,
            })
        );
}

/**
 * Simply move videos and audios from src to media
 */
function moveMultimedia() {
    const size = plugins.size();
    return gulp
        .src(paths.multimedia.source)
        .pipe(size)
        .pipe(plugins.newer(paths.multimedia.dest))
        .pipe(gulp.dest(paths.multimedia.dest))
        .pipe(plugins.notify({ message: `Multimedia moved successfuly! Total size ${size.prettySize}`, onLast: true }));
}

/**
 * Simply move Lottie json files from src to media
 */
function moveLotties() {
    return gulp
        .src(paths.lottie.source)
        .pipe(gulp.dest(paths.lottie.dest))
        .pipe(plugins.notify({ message: 'Lottie json files moved successfuly!', onLast: true }));
}


/**
 * Insert the Google Sheets data into the html
 */
function insertSpreadsheetData() {
    if (paths.xls) {
        try {
            const file = fs.readFileSync('./cells.json');
            const json = JSON.parse(file);
            const pattern = /\[\[cell::([A-Z]{1}[0-9]{1,2})\]\]/gm;

            return gulp.src(`${paths.html.dest}/index.html`)
                .pipe(plugins.replace(pattern, (a, b) => {
                    if (!json[b]) {
                        // eslint-disable-next-line max-len
                        console.log(plugins.chalk.red(`There is no cell ${plugins.chalk.inverse(' %s ')} in your spreadsheet!`), b);
                        return '———';
                    }
                    return json[b];
                }))
                .pipe(gulp.dest(paths.html.dest));
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log('Cells.json file not found!');
            }
            return Promise.resolve();
        }
    } else {
        return Promise.resolve();
    }
}

/**
 * Bump the version of the build
 */
function bumpVersion() {
    const version = (!!args.release || !!args.production)
        ? plugins.semver.inc(params.version, args.production ? 'minor' : 'patch')
        : params.version;
    const shortVersion = version.split('.').pop();
    console.log(`⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ Current Version: ${plugins.chalk.inverse(' %s ')}`, version);

    gulp
        .src(['./package.json'])
        .pipe(plugins.bump({ version }))
        .pipe(gulp.dest('./'));

    return gulp
        .src(paths.html.targets.map(t => `${paths.html.dest}/${t}.html`))
        .pipe(plugins.replace(/\?v=([^\"]+)/g, `?v=${shortVersion}`))
        .pipe(plugins.replace(/name="version" content="[\d\.]+"/g, `name="version" content="${shortVersion}"`))
        .pipe(gulp.dest(paths.html.dest));
}

/**
 * Validate the JSON data file for the build
 */
function jsonLint() {
    return gulp
        .src(paths.json)
        .pipe(plugins.jsonLint())
        .pipe(plugins.jsonLint.report('verbose'));
}

/**
 * Utility for returning a stream as a promise
 */
function promisifyStream(stream) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise(resolve => stream.on('end', resolve));
}

/**
 * Process the Twig template for the build including any api fetches (global header/footer from WAPO)
 */
async function twig() {

    const dataFiles = paths.html.targets.map(t => `data${t === 'index' ? '' : `-${t}`}`);

    await Promise.all(
        dataFiles.map(file => {
            let data;
            try {
                data = JSON.parse(fs.readFileSync(`./${file}.json`, 'utf8'));
            } catch (err) {
                return null;
            }

            // data.navigation_menu = navigationMenu.data;
            // data.footer = footer.data;
            data.development = !args.release;
            data.version = params.version.split('.').pop();

            const distFile = `${file.replace(/data-?/, '') || 'index'}.html`;

            return promisifyStream(
                gulp
                    .src('./views/index.html')
                    .pipe(plugins.twig({ data }))
                    .pipe(plugins.replace(/ ([a-z]{1,2}) /g, ' $1&nbsp;'))
                    .pipe(plugins.replace(/(<head>[\s<a-z="->!?|[\]_{}]+)&nbsp;([\s<a-z="->!?|[\]_{}]+<\/head>)/gmi, '$1 $2'))
                    .pipe(plugins.rename(distFile))
                    .pipe(gulp.dest(paths.html.dest))
            ).then(() => console.log(`${plugins.chalk.cyan('%s')} rendered`, distFile));
        })
    );
}


/**
 * Download Google Sheets' data
 */
async function fetchSpreadsheetData() {
    const ar = await axios.get(paths.xls);
    const cells = {};
    const az = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ar.data.split('\r\n').forEach((row, i) => {
        row.split('\t').forEach((cell, j) => {
            if (cell) { cells[az[j] + (i + 1)] = cell; }
        });
    });
    await fs.writeFile('cells.json', JSON.stringify(cells), err => {
        if (err) { console.log(err); } else {
            console.log('File written successfully\n');
        }
    });
}

/**
 * Generate twig files for audio's subtitles files
 */
function generateSubtitles() {
    return Promise.all(
        fs.readdirSync(paths.vtt.source).map((file, index) => new Promise(resolve => {

            // convert only from .srt/.vtt files
            const extension = file.split('.').pop();
            if (!extension.match(/srt|vtt/i)) { resolve(); return; }

            // output html here
            let html = '';

            const dirname = `${paths.vtt.dest}`;
            const fileContent = fs.readFileSync(paths.vtt.source + file, 'utf8');

            // split file into labeled phrases/sentences
            const subtitlesArray = fileContent.split('\r\n\r\n');

            subtitlesArray.forEach(sentence => {
                if (sentence === '') return;

                // get timestamp and remove arrow to get start & end time
                let sentenceTime = sentence.split('\n')[1].split(' ');
                sentenceTime.splice(1, 1);
                sentenceTime = sentenceTime.map(item => {
                    // eslint-disable-next-line no-param-reassign
                    // remove 0-s from start of timestamp
                    const cropIndex = item.search(/[^:0]/);
                    // eslint-disable-next-line no-param-reassign
                    item = item.slice(cropIndex, item.length).replace(',', '.').replace(/[^ -~]+/g, '');

                    // if time > 1 minute, covert minutes to seconds
                    if (item.length > 6) {
                        const minutes = parseInt(item.split(':')[0], 10);
                        const seconds = parseFloat(item.split(':')[1]);
                        // eslint-disable-next-line no-param-reassign
                        item = (minutes * 60 + seconds).toString();
                    }
                    return item;
                });

                // get subtitles' text
                const sentenceText = sentence.split('\n');
                sentenceText.splice(0, 2);

                // build output html
                // eslint-disable-next-line max-len
                html += `<span data-start="${sentenceTime[0]}" data-end="${sentenceTime[1]}">${sentenceText.join(' ').replace('\r', '')}</span>\n`;
            });

            // save file to /views directory
            !fs.existsSync(dirname) && fs.mkdirSync(dirname);
            fs.writeFileSync(`${dirname}/subtitles-${index}.twig`, html);
            resolve();
        }))
    );
}


/**
 * Fix absolute media paths
 */
function fixMediaPaths() {
    return gulp
        .src('./dist/*.html')
        .pipe(plugins.replace(/([\"\']{1})\/media\//g, '$1./media/'))
        .pipe(gulp.dest(paths.html.dest))
        .pipe(browserSync.stream());
}

/**
 * Format the output for the page
 */
function format() {
    return gulp
        .src('./dist/*.html')
        .pipe(
            plugins.formatHtml({
                indent_char: ' ',
                indent_size: 2,
                preserve_newlines: false,
            })
        )
        .pipe(gulp.dest(paths.html.dest))
        .pipe(browserSync.stream());
}


/**
 * Bundle all assets for the build
 */
function bundle() {
    const bundler = plugins.browserify({
        basedir: '.',
        debug: !args.release,
        entries: [paths.scripts.main],
        cache: {},
        packageCache: {},
        plugin: [plugins.tsify],
    });

    return bundler
        .bundle()
        .pipe(source(paths.scripts.file))
        .pipe(buffer())
        .pipe(plugins.addSrc.prepend(`${paths.scripts.dest}/libs.js`))
        .pipe(plugins.if(!args.release, plugins.header('/* development */\n')))
        .pipe(plugins.concat(paths.scripts.file))
        .pipe(plugins.if(!!args.release, plugins.stripDebug()))
        .pipe(plugins.if(!args.release, plugins.sourcemaps.init({ loadMaps: true })))
        .pipe(plugins.if(args.release, plugins.terser()))
        .pipe(plugins.if(!args.release, plugins.sourcemaps.write()))
        .pipe(plugins.size())
        .pipe(gulp.dest(paths.scripts.dest))
        .pipe(plugins.notify('Bundle scripts ready!'));
}

/**
 * Watch for any changes in assets used in the bundle of the build
 */
function watchBundle() {
    const bundler = plugins.browserify({
        basedir: '.',
        debug: true,
        entries: [paths.scripts.main],
        cache: {},
        packageCache: {},
        plugin: [plugins.tsify],
    });

    const reBundle = () => {
        log('Starting Re-Bundling of Assets...');

        return (
            bundler
                .bundle()
                .on('error', log.error)
                .pipe(source(paths.scripts.file))
                .pipe(buffer())
                .pipe(plugins.addSrc.prepend(`${paths.scripts.dest}/libs.js`))
                .pipe(plugins.concat(paths.scripts.file))
                .pipe(gulp.dest(paths.scripts.dest))
                .pipe(browserSync.stream())
                .pipe(plugins.notify('Bundle scripts ready!'))
        );
    };

    bundler.plugin(plugins.watchify, {
        delay: 100,
        ignoreWatch: ['**/node_modules/**'],
        poll: false,
    });

    bundler.on('update', reBundle);
    bundler.on('log', log);



    return reBundle();
}

/**
 * Watch for any changes to the core files/components for the build
 */
function watch() {
    browserSync.use({
        plugin() {},
        hooks: { 'client:js': autoClose },
    });
    plugins.portfinder.basePort = 7000;
    plugins.portfinder.getPort({ port: 7000, stopPort: 7999 }, () => {
        browserSync.init({
            open: 'external',
            // https: true,
            ghostMode: false,
            server: 'dist',
        });
    });

    gulp.watch(paths.styles.main, styles);
    // custom image watch start
    const imageWatcher = gulp.watch(paths.images.sourceSharp);
    imageWatcher.on('add', filePath => { console.log(`${filePath} was added`); imageCompression({ silent: true }); });
    imageWatcher.on('change', filePath => { deleteImages(filePath, true); imageCompression({ silent: true }); });
    imageWatcher.on('unlink', filePath => deleteImages(filePath));
    // custom image watch end
    gulp.watch(paths.images.compressed, copyCompressed);
    gulp.watch(paths.multimedia.source, moveMultimedia);
    gulp.watch(paths.lottie.source, moveLotties);
    gulp.watch(paths.html.files, exports.html);
    gulp.watch(
        paths.svg.files,
        gulp.series(svgNoMinify, svgMinify, svgStore, exports.html)
    );
    gulp.watch(paths.json, jsonLint);

    watchBundle();
}

/**
 * Saves current build's status in a text file
 */
function status() {
    const bs = args.release ? 'production' : 'development';
    const bsi = args.release ? '✓' : '✕';
    // eslint-disable-next-line no-promise-executor-return
    return new Promise(resolve => fs.writeFile('status.txt', bs, () => {
        console.log(`${args.release ? '\x1b[32m' : '\x1b[31m'}%s\x1b[0m`, `⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ Status: ${bs.toUpperCase()} ${bsi}`);
        resolve();
    }));
}

/**
 * Empty task
 * (just for development conditionals)
 */
function empty() {
    return Promise.resolve();
}


/**
 * Moves videos and audios
 */
exports.multimedia = moveMultimedia;

/**
 * Moves Lottie json files
 */
exports.lottie = moveLotties;

/**
 * Cleans the build directory
 */
exports.clean = clean;

/**
 * Compiles the css from the scss
 */
exports.styles = styles;

/**
 * Combines all of the js libraries
 */
exports.libs = libs;

/**
 * Compiles all of the javascript components
 */
exports.scripts = bundle;

/**
 * Remove all images from the build
 */
exports.cleanImages = cleanImages;

/**
 * Rebuild all images in dist - recommended before a release unless no images were changed since the last one
 */
exports.rebuildImages = gulp.series(
    cleanImages,
    imageCompression,
    copyCompressed,
    svgNoMinify,
    svgMinify,
    svgStore
);

/**
 * Handles all of the compression and optimization for images/svgs
 */
exports.images = gulp.series(
    imageCompression,
    copyCompressed,
    svgNoMinify,
    svgMinify,
    svgStore
);

/**
 * Creates the html and updates it with any svgs as applicable
 */
exports.html = gulp.series(twig, insertSVGs, insertSpreadsheetData, fixMediaPaths, format, validateHTML);

/**
 * Bumps the version
 */
exports.bump = bumpVersion;

/**
 * Tests the build
 */
exports.test = test;

/**
 * Saves current build's status
 */
exports.status = status;

/**
 * Download Google Sheets' data
 */
exports.fetch = fetchSpreadsheetData;
exports.xls = insertSpreadsheetData;

/**
 * Generate twig files for audio's subtitles files
 */
exports.vtt = generateSubtitles;

/**
 * Build the page
 */
exports.default = gulp.series(
    args.release ? exports.clean : empty,
    exports.images,
    exports.html,
    exports.styles,
    exports.libs,
    exports.scripts,
    exports.multimedia,
    exports.lottie,
    args.release ? exports.test : empty,
    exports.bump,
    exports.status,
);

/**
 * Watches any changes to code and refreshes the browser with a full build
 */
exports.watch = gulp.series(exports.status, watch);
