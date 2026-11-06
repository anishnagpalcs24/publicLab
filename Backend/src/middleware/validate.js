export function validate(validationFn) {
  return (req, res, next) => {
    if (typeof validationFn === "function") {
      const error = validationFn(req);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error,
        });
      }
    }
    next();
  };
}

export default validate;

