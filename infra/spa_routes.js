// CloudFront Function (viewer request): serve the app shell for client-side routes.
// /incidents/123 -> /index.html; /favicon.ico and other files pass through unchanged.
function handler(event) {
  var request = event.request;
  var last = request.uri.split('/').pop();
  if (last.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
