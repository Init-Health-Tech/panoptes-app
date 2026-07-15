const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const webpack = require('webpack');
const BundleTracker = require('webpack-bundle-tracker');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  const isStandalone = process.env.STANDALONE === '1' || process.env.VERCEL === '1';
  const nodeModulesDir = path.resolve(__dirname, 'node_modules');
  const apiBaseUrl = (process.env.API_BASE_URL || '').replace(/\/$/, '');

  // On Vercel the SPA cannot call same-origin /api — fail the build if unset.
  if (process.env.VERCEL === '1' && !apiBaseUrl) {
    throw new Error(
      'API_BASE_URL is required on Vercel. Set it in Project → Settings → Environment Variables ' +
        '(e.g. https://api.avant.init.com.mx) for Production, then Redeploy.',
    );
  }

  const localhostOutput = {
    path: path.resolve('./frontend/webpack_bundles/'),
    publicPath: 'http://localhost:3000/frontend/webpack_bundles/',
    filename: '[name].js',
  };
  const productionOutput = {
    path: path.resolve(isStandalone ? './frontend/dist' : './frontend/webpack_bundles/'),
    publicPath: isStandalone ? '/' : 'auto',
    filename: isStandalone ? 'assets/[name]-[chunkhash].js' : '[name]-[chunkhash].js',
    clean: true,
  };

  return {
    mode: isDev ? 'development' : 'production',
    devtool: 'source-map',
    devServer: {
      hot: true,
      historyApiFallback: true,
      host: '0.0.0.0',
      port: 3000,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
    context: __dirname,
    entry: ['./frontend/js/index.tsx'],
    output: isDev ? localhostOutput : productionOutput,
    module: {
      rules: [
        {
          test: /\.(js|mjs|jsx|ts|tsx)$/,
          use: {
            loader: 'swc-loader',
          },
        },
        {
          test: /\.css$/,
          use: [
            isDev && 'style-loader',
            !isDev && MiniCssExtractPlugin.loader,
            { loader: 'css-loader', options: { importLoaders: 1 } },
            'postcss-loader',
          ].filter(Boolean),
        },
        {
          test: /\.(svg)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset',
        },
        {
          test: /\.(woff(2)?|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset',
        },
        {
          test: /\.(png|jpg|jpeg|gif|webp)?$/,
          type: 'asset',
        },
      ],
    },
    plugins: [
      !isDev &&
        new MiniCssExtractPlugin({
          filename: isStandalone ? 'assets/[name]-[chunkhash].css' : '[name]-[chunkhash].css',
        }),
      isDev && new ReactRefreshWebpackPlugin(),
      !isStandalone &&
        new BundleTracker({
          path: __dirname,
          filename: 'webpack-stats.json',
        }),
      isStandalone &&
        new HtmlWebpackPlugin({
          template: path.resolve(__dirname, 'frontend/public/index.html'),
          filename: 'index.html',
          apiBaseUrl,
        }),
      new webpack.DefinePlugin({
        'process.env.API_BASE_URL': JSON.stringify(apiBaseUrl),
      }),
      new NodePolyfillPlugin(),
      new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] }),
    ].filter(Boolean),
    resolve: {
      fullySpecified: false,
      modules: [nodeModulesDir, path.resolve(__dirname, 'frontend/js/')],
      alias: { '@': path.resolve(__dirname, 'frontend') },
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    optimization: {
      minimize: !isDev,
      splitChunks: {
        chunks: 'all',
      },
    },
  };
};
