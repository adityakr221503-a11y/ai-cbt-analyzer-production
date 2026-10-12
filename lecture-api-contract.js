/*
Future backend contract.

GET  /api/lectures
GET  /api/lectures/:id
POST /api/lectures/:id/progress
POST /api/lectures/:id/bookmark

No video URLs are stored here.
No payment processing is implemented here.
No lecture content is included here.
*/

module.exports = {
  endpoints: [
    "GET /api/lectures",
    "GET /api/lectures/:id",
    "POST /api/lectures/:id/progress",
    "POST /api/lectures/:id/bookmark"
  ]
};
