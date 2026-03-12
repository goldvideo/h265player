module.exports = (ctx) => ({
  parser: ctx.parser ? 'sugarss' : false,
  map: ctx.env === 'development' ? ctx.map : false,
  plugins: {
    'postcss-import': {},
    'postcss-preset-env': {},
    'postcss-url': {},
    'cssnano': {
      preset: ['default', {
        discardComments: {
          removeAll: true
        }
      }]
    }
  }
})