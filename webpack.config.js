const path = require('path');

module.exports = {
  entry: './app/Controller/MainController.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devtool: "inline-source-map",
};
