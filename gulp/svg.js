/* eslint-disable import/no-extraneous-dependencies */
const fs = require('fs');
const gulp = require('gulp');
const newer = require('gulp-newer');
const svgmin = require('gulp-svgmin');
const notify = require('gulp-notify');
const rename = require('gulp-rename');
const svgstore = require('gulp-svgstore');
const config = require('../gulp-config.json');

const { paths } = config;


/**
 * Minify the svgs for the build
 */
function svgMinify() {
    return gulp
        .src(paths.svg.inline)
        .pipe(newer(paths.svg.dest))
        .pipe(svgmin({ plugins: [{ removeViewBox: false }] }))
        .pipe(gulp.dest(paths.svg.dest))
        // .pipe(browserSync.stream())
        .pipe(
            notify({
                message: 'SVG minified successfuly!',
                onLast: true,
            })
        );
}

/**
 * Copy svgs that should not be minified to the build
 */
function svgNoMinify() {
    return gulp
        .src(paths.svg.nomin)
        .pipe(newer(paths.svg.dest))
        .pipe(gulp.dest(paths.svg.dest))
        .pipe(notify({
            message: 'SVG no-min copied successfuly!',
            onLast: true,
        }));
}

/**
 * Generate sprite from svgs
 */
function svgStore() {
    return gulp
        .src(paths.svg.sprite)
        .pipe(
            svgmin({
                plugins: [
                    { removeAttrs: { attrs: '(fill|stroke)' } },
                    { addAttributesToSVGElement: { attribute: 'preserveAspectRatio="xMidYMid meet"' } },
                ]
            })
        )
        .pipe(rename({ prefix: 'sprite-' }))
        .pipe(svgstore({ fileName: 'sprite.svg', inlineSvg: true }))
        .pipe(gulp.dest(paths.svg.dest))
        .pipe(notify({ message: 'SVG sprite created!', onLast: true }));
}

/**
 * Insert the svgs into the build
 */
function insertSVGs() {
    const distFiles = paths.html.targets;
    const svgPattern = /\[\[svg::([0-9a-z-_]+)\]\]/gm;
    const spritePattern = /\[\[sprite::([0-9a-z-_]+)\]\]/gm;

    return Promise.all(
        distFiles.map(file => new Promise(resolve => {
            fs.readFile(`${paths.html.dest}/${file}.html`, 'utf-8', (error, html) => {
                let match;
                const svgMatches = [];
                const spriteMatches = [];
                let newHtml = html;

                // eslint-disable-next-line no-cond-assign
                while ((match = svgPattern.exec(html))) { svgMatches.push(match[1]); }
                // eslint-disable-next-line no-cond-assign
                while ((match = spritePattern.exec(html))) { spriteMatches.push(match[1]); }

                Promise.all(
                    svgMatches
                        .map(name => new Promise(resolveA => {
                            fs.readFile(`${paths.svg.dest + name}.svg`, 'utf-8', (error, svg) => {
                                if (svg) {
                                    newHtml = newHtml.replace(
                                        `[[svg::${name}]]`,
                                        svg.replace('<svg ', `<svg class="svg-${name}" `)
                                    );
                                } else {
                                    newHtml = newHtml.replace(`[[svg::${name}]]`, '');
                                    if (name !== 'sprite') {
                                        console.log(`svg '${name}' — not found!`);
                                    }
                                }
                                resolveA();
                            });
                        }))
                        .concat(
                            spriteMatches.map(name => new Promise(resolveB => {
                                newHtml = newHtml.replace(
                                    `[[sprite::${name}]]`,
                                    `<svg class="sprite-${name}"><use xlink:href="#sprite-${name}"/></svg>`
                                );
                                resolveB();
                            }))
                        )
                ).then(() => {
                    fs.writeFileSync(`${paths.html.dest}/${file}.html`, newHtml);
                    resolve();
                });
            });
        }))
    );
}


module.exports = {
    svgMinify,
    svgNoMinify,
    svgStore,
    insertSVGs,
};
