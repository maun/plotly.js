/* eslint-env node*/

var path = require('path');
var minimist = require('minimist');
var constants = require('../../tasks/util/constants');

var isCI = Boolean(process.env.CI);

var argv = minimist(process.argv.slice(4), {
    string: ['bundleTest', 'width', 'height'],
    'boolean': [
        'info',
        'nowatch', 'failFast', 'verbose', 'randomize',
        'Chrome', 'Firefox', 'IE11'
    ],
    alias: {
        'Chrome': 'chrome',
        'Firefox': ['firefox', 'FF'],
        'IE11': ['ie11'],
        'bundleTest': ['bundletest', 'bundle_test'],
        'nowatch': 'no-watch',
        'failFast': 'fail-fast'
    },
    'default': {
        info: false,
        nowatch: isCI,
        failFast: false,
        verbose: false,
        randomize: false,
        width: '1035',
        height: '617'
    }
});

if(argv.info) {
    console.log([
        'plotly.js karma runner for jasmine tests CLI info',
        '',
        'Examples:',
        '',
        'Run `axes_test.js`, `bar_test.js` and `scatter_test.js` suites w/o `autoWatch`:',
        '  $ npm run test-jasmine -- axes bar_test.js scatter --nowatch',
        '',
        'Run all tests with the `noCI` tag on Firefox in a 1500px wide window:',
        '  $ npm run test-jasmine -- --tags=noCI --FF --width=1500',
        '',
        'Run the `ie9_test.js` bundle test with the verbose reporter:',
        '  $ npm run test-jasmine -- --bundleTest=ie9 --verbose',
        '',
        'Arguments:',
        '  - All non-flagged arguments corresponds to the test suites in `test/jasmine/tests/` to be run.',
        '    No need to add the `_test.js` suffix, we expand them correctly here.',
        '  - `--bundleTest` set the bundle test suite `test/jasmine/bundle_tests/ to be run.',
        '    Note that only one bundle test can be run at a time.',
        '  - Use `--tags` to specify which `@` tags to test (if any) e.g `npm run test-jasmine -- --tags=gl`',
        '    will run only gl tests.',
        '  - Use `--skip-tags` to specify which `@` tags to skip (if any) e.g `npm run test-jasmine -- --skip-tags=gl`',
        '    will skip all gl tests.',
        '',
        'Other options:',
        '  - `--info`: show this info message',
        '  - `--Chrome` (alias `--chrome`): run test in (our custom) Chrome browser',
        '  - `--Firefox` (alias `--FF`, `--firefox`): run test in (our custom) Firefox browser',
        '  - `--IE11` (alias -- `ie11`)`: run test in IE11 browser',
        '  - `--nowatch (dflt: `false`, `true` on CI)`: run karma w/o `autoWatch` / multiple run mode',
        '  - `--failFast` (dflt: `false`): exit karma upon first test failure',
        '  - `--verbose` (dflt: `false`): show test result using verbose reporter',
        '  - `--showSkipped` (dflt: `false`): show tests that are skipped',
        '  - `--randomize` (dflt: `false`): randomize test ordering (useful to detect bad test teardown)',
        '  - `--tags`: run only test with given tags (using the `jasmine-spec-tags` framework)',
        '  - `--width`(dflt: 1035): set width of the browser window',
        '  - `--height` (dflt: 617): set height of the browser window',
        '',
        'For info on the karma CLI options run `npm run test-jasmine -- --help`'
    ].join('\n'));
    process.exit(0);
}

var SUFFIX = '_test.js';
var basename = function(s) { return path.basename(s, SUFFIX); };
var merge = function(_) {
    var list = [];

    (Array.isArray(_) ? _ : [_]).forEach(function(p) {
        list = list.concat(p.split(','));
    });

    return list;
};
var glob = function(_) {
    return _.length === 1 ?
        _[0] + SUFFIX :
        '{' + _.join(',') + '}' + SUFFIX;
};

var isBundleTest = !!argv.bundleTest;
var isFullSuite = !isBundleTest && argv._.length === 0;
var testFileGlob;

if(isFullSuite) {
    testFileGlob = path.join(__dirname, 'tests', '*' + SUFFIX);
} else if(isBundleTest) {
    var _ = merge(argv.bundleTest);

    if(_.length > 1) {
        console.warn('Can only run one bundle test suite at a time, ignoring ', _.slice(1));
    }

    testFileGlob = path.join(__dirname, 'bundle_tests', glob([basename(_[0])]));
} else {
    testFileGlob = path.join(__dirname, 'tests', glob(merge(argv._).map(basename)));
}

var pathToShortcutPath = path.join(__dirname, '..', '..', 'tasks', 'util', 'shortcut_paths.js');
var pathToStrictD3 = path.join(__dirname, '..', '..', 'tasks', 'util', 'strict_d3.js');
var pathToJQuery = path.join(__dirname, 'assets', 'jquery-1.8.3.min.js');
var pathToIE9mock = path.join(__dirname, 'assets', 'ie9_mock.js');
var pathToCustomMatchers = path.join(__dirname, 'assets', 'custom_matchers.js');
var pathToUnpolyfill = path.join(__dirname, 'assets', 'unpolyfill.js');
var pathToMathJax = path.join(constants.pathToDist, 'extras', 'mathjax');

var reporters = ((isFullSuite && !argv.tags) || argv.showSkipped) ? ['dots', 'spec'] : ['progress'];
if(argv.verbose) reporters.push('verbose');

function func(config) {
    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    //
    // NB: if you try config.LOG_DEBUG, you may actually be looking for karma-verbose-reporter.
    //     See CONTRIBUTING.md for additional notes on reporting.
    func.defaultConfig.logLevel = config.LOG_INFO;

    // without this, console logs in the plotly.js code don't print to
    // the terminal since karma v1.5.0
    //
    // See https://github.com/karma-runner/karma/commit/89a7a1c#commitcomment-21009216
    func.defaultConfig.browserConsoleLogOptions = {
        level: 'debug'
    };

    config.set(func.defaultConfig);
}

func.defaultConfig = {

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: constants.pathToRoot,

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine', 'jasmine-spec-tags', 'browserify', 'viewport'],

    // list of files / patterns to load in the browser
    //
    // N.B. the rest of this field is filled below
    files: [
        pathToCustomMatchers,
        pathToUnpolyfill,
        // available to fetch from /base/path/to/mathjax
        // more info: http://karma-runner.github.io/3.0/config/files.html
        {pattern: pathToMathJax + '/**', included: false, watched: false, served: true},
        // available to fetch local topojson files
        {pattern: constants.pathToTopojsonDist + '/**', included: false, watched: false, served: true}
    ],

    // list of files / pattern to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    //
    // N.B. this field is filled below
    preprocessors: {},

    // test results reporter to use
    // possible values: 'dots', 'progress', 'spec' and 'verbose'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    //
    // See note in CONTRIBUTING.md about more verbose reporting via karma-verbose-reporter:
    // https://www.npmjs.com/package/karma-verbose-reporter ('verbose')
    //
    reporters: reporters,

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: !argv.nowatch,

    // if true, Karma captures browsers, runs the tests and exits
    singleRun: argv.nowatch,

    // how long will Karma wait for a message from a browser before disconnecting (30 ms)
    browserNoActivityTimeout: 30000,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    //
    // N.B. this field is filled below
    browsers: [],

    // custom browser options
    //
    // window-size values came from observing default size
    //
    // '--ignore-gpu-blacklist' allow to test WebGL on CI (!!!)
    customLaunchers: {
        _Chrome: {
            base: 'Chrome',
            flags: [
                '--touch-events',
                '--window-size=' + argv.width + ',' + argv.height,
                isCI ? '--ignore-gpu-blacklist' : '',
                (isBundleTest && basename(testFileGlob) === 'no_webgl') ? '--disable-webgl' : ''
            ]
        },
        _Firefox: {
            base: 'Firefox',
            flags: ['--width=' + argv.width, '--height=' + argv.height]
        }
    },

    browserify: {
        transform: [pathToStrictD3, pathToShortcutPath],
        extensions: ['.js'],
        watch: !argv.nowatch,
        debug: true
    },

    client: {
        // Options for `karma-jasmine-spec-tags`
        // see https://www.npmjs.com/package/karma-jasmine-spec-tags
        //
        // A few tests don't behave well on CI
        // add @noCI to the spec description to skip a spec on CI
        //
        // Although not recommended, some tests "depend" on other
        // tests to pass (e.g. the Plotly.react tests check that
        // all available traces and transforms are tested). Tag these
        // with @noCIdep, so that
        // - $ npm run test-jasmine -- tags=noCI,noCIdep
        // can pass.
        //
        // Label tests that require a WebGL-context by @gl so that
        // they can be skipped using:
        // - $ npm run test-jasmine -- --skip-tags=gl
        // or run is isolation easily using:
        // - $ npm run test-jasmine -- --tags=gl
        tagPrefix: '@',
        skipTags: isCI ? 'noCI' : null,

        // See https://jasmine.github.io/api/3.4/Configuration.html
        jasmine: {
            random: argv.randomize,
            failFast: argv.failFast
        }
    },

    // use 'karma-spec-reporter' to log info about skipped specs
    specReporter: {
        suppressErrorSummary: true,
        suppressFailed: true,
        suppressPassed: true,
        suppressSkipped: false,
        showSpecTiming: false
    }
};

func.defaultConfig.preprocessors[pathToCustomMatchers] = ['browserify'];

if(isBundleTest) {
    switch(basename(testFileGlob)) {
        case 'requirejs':
            // browserified custom_matchers doesn't work with this route
            // so clear them out of the files and preprocessors
            func.defaultConfig.files = [
                constants.pathToRequireJS,
                constants.pathToRequireJSFixture
            ];
            delete func.defaultConfig.preprocessors[pathToCustomMatchers];
            break;
        case 'minified_bundle':
            func.defaultConfig.files.push(constants.pathToPlotlyDistMin);
            func.defaultConfig.preprocessors[testFileGlob] = ['browserify'];
            break;
        case 'ie9':
            // load ie9_mock.js before plotly.js+test bundle
            // to catch reference errors that could occur
            // when plotly.js is first loaded.
            func.defaultConfig.files.push(pathToIE9mock);
            func.defaultConfig.preprocessors[testFileGlob] = ['browserify'];
            break;
        case 'plotschema':
            func.defaultConfig.browserify.ignoreTransform = './tasks/compress_attributes.js';
            func.defaultConfig.preprocessors[testFileGlob] = ['browserify'];
            break;
        default:
            func.defaultConfig.preprocessors[testFileGlob] = ['browserify'];
            break;
    }
} else {
    func.defaultConfig.files.push(pathToJQuery);
    func.defaultConfig.preprocessors[testFileGlob] = ['browserify'];
}

// lastly, load test file glob
func.defaultConfig.files.push(testFileGlob);

// add browsers
var browsers = func.defaultConfig.browsers;
if(argv.Chrome) browsers.push('_Chrome');
if(argv.Firefox) browsers.push('_Firefox');
if(argv.IE11) browsers.push('IE');
if(browsers.length === 0) browsers.push('_Chrome');

module.exports = func;
