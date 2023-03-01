# BrandStudio Development Setup
This setup uses twig.js for templating. More info on twig.js templating can be found [here](https://github.com/twigjs/twig.js/wiki).
twig.js JSON data is stored in ``data.json``.

## Folder Structure
The ``src`` folder contains scss, js, and media files and they will compile to ``dist``.
The ``dist`` folder will contain compiled html, js and css

## SCSS/JS
Webpack is used to compile JS and SCSS, html, images and twig.js templates. The configs are located in the root. If you edit the config, please ensure output remains in the same paths for the production deployment. Upon commit, the production task will be run and will compile the project to the ``dist`` folder.

## Media Files
Images and videos stored in the repository for the project must be placed in ``src/media/``.
On your local setup, they will show up using ``./media/FILENAME.EXT``. (please remember the ./)
On production, these images will be compressed and output to ``dist/media``.

## Image Preparation
Only .jpg (not .jpeg) and .png file formats are supported.
Minimum image dimensions for automated compression are 16*16px.
Recommended image dimensions (by width) are [desktop: 2800px; tablet, mobile: 1100px] ***TO BE DISCUSSED :-D*** for full screen width (ie. if image takes up 50% of the design's width, scale accordingly).

For best results please provide high quality images (ie. avoid compressing when resizing in Photoshop), but try to keep file sizes below 3MB per image (to keep the repo lean).
Some file size limit exceptions to consider are .png files containing complicated geometrical and/or noise patterns.Typical image processing software (eg. Photoshop) does not allow
.png compression so in such cases feel free to provide a file larger than the recommended limit - the image script handles this nicely.

## Image Compression Settings
in ./imageCompression.js (ln36) you'll find a compressionSettings object with tested settings:

    jpg: { quality: 60 (0-100, default: 80), mozjpeg: true },
    png: { quality: 60 (0-100, default: 100), compressionLevel: 8 (0-6, default: 6), effort: 8 (0-10, default: 7) },
    webp: { quality: 70 (0-100, default: 80), effort: 5 effort: 8 (0-6, default: 4) },
    avif: { quality: 60 (0-100, default: 50), chromaSubsampling: '4:2:0', effort: 6 (0-9, default: 4) }

Always remember to check image quality visually, if not satisified bump quality settings up a bit.
For more information visit [Sharp Website](https://sharp.pixelplumbing.com/api-output)

Note: an images-compressed folder exists in src for special cases where you'd prefer to run compression on your own. These files simply get copied over to dist without changes.

## External Video Files
Video files to be used in the project that will not be stored in the repository must be added to ``data.json`` under the "videos" object. This is used to upload the files to s3 as well, so they must be in this list to be uploaded on deploy.
```javascript
...
"videos": {
	"pet_parents": "https://wp-stat.s3.amazonaws.com/brandstudio/geico-pet-parents/geico3.mp4"
}
```
These can be accessed in your twig.js template like this: ``<video src="{{ videos.pet_parents }}" controls></video>``

## Inline SVGs
You can make an svg render inline in the template by using this markup when adding it. The class will be pass along to the svg and it will be minified.
```
[[svg::circle]]
```
This will render like so:
```
<svg class="svg-circle" viewBox="0 0 100 100">
	<circle cx="50" cy="50" r="40" fill="#ff0" stroke="green" stroke-width="4"></circle>
</svg>
```

## Google Spreadsheets' data
You can inject data from public Google Spreadsheets' document.
### Make Google Sheets public
Here's how to do it: [link](https://support.google.com/docs/answer/183965?hl=en&visit_id=637812977426842590-772297042&rd=2). Use .tsv format!
### Import data
Run `gulp fetch` to import data. It saves a `cells.json` file in the root of this project.
### Injecting data to html
If you put a `[[cell::A3]]` snippet to .twig or data.json, it will be replaced by proper data from the `cells.json` file. You can run it by `gulp xls` but also it's a part of `gulp html` task.

## Google Tag Manager/ Analytics
Google Tag Manager is set up on all pages for tracking, pageviews and events.
### Onclick events
Onclick events are handled automatically in GTM based on data-attributes in the markup.  The values needed for each event should be supplied by analytics for each release.
Here is an example of the markup:
```
    <button data-gtm-onpage-click-label="social-share-facebook" data-gtm-category="social" data-gtm-action="social-share">Facebook</button>
```
The data atributes are organized as follows:
``data-gtm-onpage-click-label`` is needed to trigger the event in GTM.  GTM searches for clicks on elements with this attribute. This is storing the 'label' value.
Additionally, there is ``data-gtm-category``, and ``data-gtm-action``.
All of these attributes will be stored as part of the event if they are supplied, but the only required attribute is ``data-gtm-onpage-click-label``.


## Local Server
You can use a local server to view changes in your project.  BrowserSync is set up to view pages on your local server without refreshing manually.
&NewLine;
```bash
npm run watch
```

## Versioning
The version number in package.json is incremented on the 3rd digit on every push. ex.(1.0.x)
The version number can be updated manually with the `npm run bump` command.


### Mobile Local Testing

For Local testing on a mobile device, get your local ip address and access port 3000
eg. http://192.168.1.12:3000


## Linters
We are using linters. In VSCode add these extensions:
[EsLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint),
[Stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint),
[stylelint-plus](https://marketplace.visualstudio.com/items?itemName=hex-ci.stylelint-plus)

Also add these settings to `settings.json`
```
"editor.defaultFormatter": "dbaeumer.vscode-eslint",
"eslint.format.enable": true,
"eslint.lintTask.enable": true,
"eslint.alwaysShowStatus": true,
"eslint.validate": [
    "javascript",
    "typescript",
],
"editor.formatOnSave": false,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.fixAll.stylelint": true
},
"css.validate": false,
"less.validate": false,
"scss.validate": false,
"stylelint.enable": true,
"files.autoSaveDelay": 200,
```
