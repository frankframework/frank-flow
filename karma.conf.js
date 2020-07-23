// Karma configuration
// Generated on Sat Dec 16 2017 16:32:55 GMT+0600 (Bangladesh Standard Time)
module.exports = function(config) {
    config.set({
  
      // base path that will be used to resolve all patterns (eg. files, exclude)
      basePath: '',
  
  
      // frameworks to use
      // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
      frameworks: ['jasmine', 'jasmine-jquery'],
      plugins: ['@metahub/karma-jasmine-jquery', 'karma-*'],
  
  
  
      // list of files / patterns to load in the browser
      files: [
        // 'test/**/*.js',


        'node_modules/jquery/dist/jquery.min.js',
        'node_modules/jquery-ui-dist/jquery-ui.min.js',
        'fileTree/dist/js/file-tree.min.js',

      	// 'node_modules/monaco-editor/min/vs/loader.js',
        // 'node_modules/monaco-editor/min/vs/editor/editor.main.nls.js',
        // 'node_modules/monaco-editor/min/vs/editor/editor.main.js',
        'index.html',
        //'dist/*.js',
  
        'test/*.[sS]pec.js',
        // 'dist/*.js',
      ],

      html2JsPreprocessor: {
        // strip this from the file path
        stripPrefix: 'public/',
  
        // prepend this to the file path
        prependPrefix: 'served/',
  
        // or define a custom transform function
        processPath: function(filePath) {
          // Drop the file extension
          return filePath.replace(/\.html$/, '');
        }
      },
  
  
      // list of files to exclude
      exclude: [
  
      ],
  
  
      // preprocess matching files before serving them to the browser
      // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
      preprocessors: {
        'dist/*.js': ['coverage'],
        'test/**/*.[sS]pec.js': ['webpack'],
        '**/*.html': ['html2js'],
      },
      // test results reporter to use
      // possible values: 'dots', 'progress'
      // available reporters: https://npmjs.org/browse/keyword/karma-reporter
      reporters: ['progress', 'coverage'],
  
  
      // web server port
      port: 9876,
  
  
      // enable / disable colors in the output (reporters and logs)
      colors: true,
  
  
      // level of logging
      // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
      logLevel: config.LOG_INFO,
  
  
      // enable / disable watching file and executing tests whenever any file changes
      autoWatch: true,
  
  
      // start these browsers
      // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
      browsers: ['Chrome'],
  
  
      // Continuous Integration mode
      // if true, Karma captures browsers, runs the tests and exits
      singleRun: false,
  
     webpack: {
        // karma watches the test entry points
        // (you don't need to specify the entry option)
        // webpack watches dependencies
  
        // webpack configuration
        mode: 'production'
      },
  
      // Concurrency level
      // how many browser should be started simultaneous
      concurrency: Infinity,
      coverageReporter: {
        dir: './coverage',
        reporters: [
          { type: 'lcov', subdir: '.' },
          { type: 'text-summary' }
        ]
      }
    })
  }