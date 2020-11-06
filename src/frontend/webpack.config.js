const path = require('path');
const webpack = require('webpack');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  optimization: {
    splitChunks: {
        cacheGroups: {
            monacoCommon: {
                test: /[\\/]node_modules[\\/]monaco-editor/,
                name: 'monaco-editor-common',
                chunks: 'async'
            }
        }
    }
  },
  entry: [
    './app/Controller/MainController.js',
  ],
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, '../../target/frontend'),
    // publicPath: '/dist/'
  },
  module: {
    rules: [
      {
        test: /\.(ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
        use: ['file-loader']
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader, // instead of style-loader
          'css-loader',
        ],
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        use: [
          'file-loader',
          {
            loader: 'image-webpack-loader',
            options: {
              disable: true,
            },
          },
        ],
      },
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ]
  },
  plugins: [
    new MonacoWebpackPlugin(),
    new MiniCssExtractPlugin(),
    new CopyPlugin({
      patterns: [
        { from: 'index.html', to: path.resolve(__dirname, '../../target/frontend') },
        { from: 'media', to: path.resolve(__dirname, '../../target/frontend/media') },
        { from: 'jquery.contextMenu.min.css', to: path.resolve(__dirname, '../../target/frontend') },
      ],
    }),
  ],
  devtool: "inline-source-map",
  target: "web",
};
