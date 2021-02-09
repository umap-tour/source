const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    stats: "minimal",
    contentBase: './public',
    // hot: false,
    // inline: false,
  },
});
