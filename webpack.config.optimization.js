const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { PurgeCSSPlugin } = require('purgecss-webpack-plugin');
const glob = require('glob');
const path = require('path');

module.exports = {
  optimization: {
    // Code splitting configuration
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 30,
      maxAsyncRequests: 30,
      minSize: 20000,
      maxSize: 244000,
      cacheGroups: {
        // Vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            // Get the name of the package
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `vendor.${packageName.replace('@', '')}`;
          },
          priority: 10,
          reuseExistingChunk: true
        },
        
        // Angular core modules
        angular: {
          test: /[\\/]node_modules[\\/]@angular[\\/]/,
          name: 'angular',
          priority: 20,
          reuseExistingChunk: true
        },
        
        // RxJS
        rxjs: {
          test: /[\\/]node_modules[\\/]rxjs[\\/]/,
          name: 'rxjs',
          priority: 15,
          reuseExistingChunk: true
        },
        
        // Common modules used across the app
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          name: 'common'
        },
        
        // Styles
        styles: {
          test: /\.(css|scss)$/,
          name: 'styles',
          chunks: 'all',
          enforce: true
        }
      }
    },
    
    // Runtime chunk for better caching
    runtimeChunk: {
      name: 'runtime'
    },
    
    // Module IDs for better caching
    moduleIds: 'deterministic',
    
    // Minimize configuration
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug']
          },
          mangle: {
            safari10: true
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true
          }
        },
        parallel: true,
        extractComments: false
      })
    ],
    
    // Tree shaking
    usedExports: true,
    sideEffects: false
  },
  
  plugins: [
    // Gzip compression
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg|json)$/,
      threshold: 10240,
      minRatio: 0.8,
      deleteOriginalAssets: false
    }),
    
    // Brotli compression
    new CompressionPlugin({
      filename: '[path][base].br',
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg|json)$/,
      compressionOptions: {
        level: 11
      },
      threshold: 10240,
      minRatio: 0.8,
      deleteOriginalAssets: false
    }),
    
    // PurgeCSS to remove unused CSS
    new PurgeCSSPlugin({
      paths: glob.sync(`${path.join(__dirname, 'src')}/**/*`, { nodir: true }),
      safelist: {
        standard: [
          /^ng-/,
          /^modal/,
          /^tooltip/,
          /^popover/,
          /^dropdown/,
          /^badge/,
          /^btn/,
          /^alert/,
          /^form/,
          /^table/,
          /^card/,
          /^nav/,
          /^pagination/,
          /^progress/,
          /^spinner/,
          /^toast/,
          /^accordion/,
          /^carousel/,
          /^offcanvas/,
          /^placeholder/
        ],
        deep: [/mdi/, /flatpickr/, /sweetalert/],
        greedy: [/velzon/]
      }
    }),
    
    // Bundle analyzer (only in analyze mode)
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
      generateStatsFile: true,
      statsFilename: 'bundle-stats.json'
    })
  ].filter(Boolean),
  
  // Performance hints
  performance: {
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
    hints: 'warning',
    assetFilter: function(assetFilename) {
      return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
    }
  },
  
  // Module resolution optimizations
  resolve: {
    symlinks: false,
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@core': path.resolve(__dirname, 'src/app/core'),
      '@shared': path.resolve(__dirname, 'src/app/shared'),
      '@modules': path.resolve(__dirname, 'src/app/modules'),
      '@components': path.resolve(__dirname, 'src/app/component'),
      '@services': path.resolve(__dirname, 'src/app/service'),
      '@interfaces': path.resolve(__dirname, 'src/app/interface'),
      '@environments': path.resolve(__dirname, 'src/environments')
    }
  }
};