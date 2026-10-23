// CloudFront Function (viewer request) for /api/*: the API's routes have no /api prefix.
// /api/incidents?status=open -> /incidents?status=open (query strings are kept separately).
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\/api(?=\/|$)/, '') || '/';
  return request;
}
