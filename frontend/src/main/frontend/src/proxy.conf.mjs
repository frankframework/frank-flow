export default [
  {
    context: ['/iaf/frankdoc'],
    target: 'https://frankdoc.frankframework.org',
    pathRewrite: {
      '/iaf/frankdoc': '/',
    },
    secure: false,
    changeOrigin: true,
  },
  {
    context: ['/frank-flow/api'],
    target: 'http://localhost:8080',
  },
];
