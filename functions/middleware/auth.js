const jwt = require("jsonwebtoken");

const authenticateJWT = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).send("Access Denied");
  
  try {
    const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).send("Invalid Token");
  }
};

const roleMiddleware = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).send("Access Denied");
  next();
};

module.exports = { authenticateJWT, roleMiddleware };
