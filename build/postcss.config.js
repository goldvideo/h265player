module.exports = (ctx) => ({
  parser: ctx.parser ? 'sugarss' : false,
  map: ctx.env === 'development' ? ctx.map : false,
  plugins: {
    'postcss-import': {},
    'precss': {},
    // 'autoprefixer': {},
    'postcss-preset-env': {},
    'postcss-cssnext': {},
    'postcss-url': {},
    'cssnano': {
      preset: 'default'
    }
  }
})