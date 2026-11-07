import { useState } from "react";
import { callbackService } from "../services/callback.service";

export function useCallbackRequest() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const submitCallback = async ({ name, phone, email, labId, message }) => {
    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    try {
      const res = await callbackService.requestCallback({
        name,
        phone,
        email,
        labId,
        message,
      });
      setIsSuccess(true);
      return res;
    } catch (err) {
      setError(err.message || "Failed to submit callback request. Please try again.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetState = () => {
    setIsSuccess(false);
    setError(null);
    setIsSubmitting(false);
  };

  return {
    submitCallback,
    isSubmitting,
    isSuccess,
    error,
    resetState,
  };
}
