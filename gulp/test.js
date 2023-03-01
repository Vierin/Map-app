/* eslint-disable */
const fs = require('fs');
const chalk = require('chalk');
const config = require('../gulp-config.json');

const { paths } = config;


/**
 * Check the build to see what components are used (actual/likely based on markup)
 */
function checkComponents() {

    const unusedComponents = [];
    const unusedBackgrounds = [];

    let usedComponents = [];
    let usedBackgrounds = [];
    let usedAnimations = [];

    const files = paths.html.targets.map(t => `${paths.html.dest}/${t}.html`);

    return new Promise(resolve => {
        Promise.all(

            files.map(file => new Promise((resolve, reject) => {

                fs.readFile(file, 'utf-8', (err, _data) => {

                    console.log(`Checking ${chalk.cyan('%s')} file...`, file);

                    if (!_data) {
                        console.log('\x1b[31m%s\x1b[0m', `There is no ${file} file!`);
                        reject(err);
                        return;
                    }

                    const backgroundMatches = _data.match(/data-background=[\"|\']([A-Za-z]+)[\"|\']/gm);
                    const componentMatches = _data.match(/data-component=[\"|\']([A-Za-z]+)[\"|\']/gm);
                    const animationMatches = _data.match(/data-(scroll|animation)=[\"|\']([A-Za-z]+)[\"|\']/gm);

                    usedBackgrounds = usedBackgrounds.concat(!backgroundMatches ? [] : backgroundMatches.map(c => c
                            .replace(/data-background=[\"|\']/, '')
                            .replace(/[\"|\']/, ''))
                        ).filter((value, index, array) => array.indexOf(value) === index)
                    .sort();

                    usedComponents = usedComponents.concat(!componentMatches ? [] : componentMatches.map(c => c
                            .replace(/data-component=[\"|\']/, '')
                            .replace(/[\"|\']/, ''))
                        ).filter((value, index, array) => array.indexOf(value) === index)
                    .sort();

                    usedAnimations = usedAnimations.concat(!animationMatches ? [] : animationMatches.map(a => a
                            .replace(/data-animation=[\"|\']/, '')
                            .replace(/data-scroll=[\"|\']/, '')
                            .replace(/[\"|\']/, ''))
                        ).filter((value, index, array) => array.indexOf(value) === index)
                    .sort();

                    resolve();
                });
            }))
        ).then(() => {

            console.log('\nUsed animations:');
            console.log(`- ${usedAnimations.join('\n- ')}`);
            console.log('¡Please check Scroll.ts!');

            return Promise.all([
                new Promise(resolve => {
                    fs.readFile(`${paths.scripts.backgrounds}All.ts`, 'utf-8', (err, _all) => {
                        console.log('\nChecking backgrounds:');
                        const re = /\s{2,}([a-z]+)[,\r]/gim;
                        let m;
                        do {
                            m = re.exec(_all);
                            if (m) {
                                const background = m[1];
                                const used = usedBackgrounds.indexOf(background) > -1 ||
                                    background === 'Background' ||
                                    background === 'All';
                                const message = used ? '\x1b[32m' : '\x1b[31m';
                                const sign = used ? '✓' : '✕';
                                console.log(`${message}%s\x1b[0m`, sign + ' ' + background);

                                if (!used) {
                                    unusedBackgrounds.push(background);
                                }
                            }
                        } while (m);

                        if (unusedBackgrounds.length > 0) {
                            console.log(chalk.inverse('¡Please remove unused components!'));
                        }

                        resolve();
                    });
                }),


                new Promise(resolve => {
                    fs.readFile(`${paths.scripts.components}All.ts`, 'utf-8', (err, _all) => {

                        console.log('\nChecking commponents:');
                        const re = /\s{2,}([a-z]+)[,\r]/gim;
                        let m;
                        do {
                            m = re.exec(_all);
                            if (m) {
                                const component = m[1];
                                const used = usedComponents.indexOf(component) > -1 ||
                                    component === 'Component' ||
                                    component === 'All';
                                const probablyUsed = ['Swipe', 'Gyro'].indexOf(component) >= 0;
                                const message = used ? '\x1b[32m' : probablyUsed ? '\x1b[33m' : '\x1b[31m';
                                const sign = used ? '✓' : probablyUsed ? '?': '✕';
                                console.log(`${message}%s\x1b[0m`, sign + ' ' + component);

                                if (!used && !probablyUsed) {
                                    unusedComponents.push(component);
                                }
                            }
                        } while (m);

                        if (unusedComponents.length > 0) {
                            console.log(chalk.inverse('¡Please remove unused backgrounds!'));
                        }

                        resolve();
                    });
                })
            ]).then(() => resolve());
        });
    });
}


module.exports = checkComponents;
