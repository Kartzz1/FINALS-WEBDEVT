// Adds "success": true to every successful JSON object response, so clients always get
// the same envelope as errors ({ "success": false, "message": ... }).
export function successFlag(req, res, next) {
  const send = res.json.bind(res);
  res.json = (body) => {
    const plainObject = body && typeof body === "object" && !Array.isArray(body);
    if (res.statusCode < 400 && plainObject && body.success === undefined) {
      return send({ success: true, ...body });
    }
    return send(body);
  };
  next();
}
