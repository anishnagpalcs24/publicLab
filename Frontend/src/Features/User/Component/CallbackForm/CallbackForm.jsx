import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Phone, Mail, MessageSquare, CheckCircle2 } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import { useCallbackRequest } from "../../hooks/useCallbackRequest";
import { useToast } from "../../../../Shared/Context/ToastContext";
import "./CallbackForm.scss";

const callbackSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters").max(100),
  phone: z
    .string()
    .min(10, "Please enter a valid 10-digit mobile number")
    .regex(/^(\+91)?[6-9]\d{9}$/, "Please enter a valid mobile number"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  message: z.string().max(500, "Message must not exceed 500 characters").optional(),
});

export default function CallbackForm({
  initialLabId,
  initialLabName,
  initialPackageName,
  onSuccess,
}) {
  const { submitCallback, isSubmitting, isSuccess, error, resetState } = useCallbackRequest();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(callbackSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      message: initialPackageName
        ? `Inquiry regarding ${initialPackageName}`
        : initialLabName
        ? `Inquiry for ${initialLabName}`
        : "",
    },
  });

  const toast = useToast();

  const onSubmit = async (data) => {
    try {
      await submitCallback({
        ...data,
        labId: initialLabId,
      });
      toast.success("Callback request received! A coordinator will contact you shortly.", "Request Submitted");
      reset();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.message || "Could not submit callback request. Please try again.", "Request Failed");
    }
  };

  if (isSuccess) {
    return (
      <div className="pl-callback-form">
        <div className="pl-callback-form__success-card">
          <div className="icon-wrap">
            <CheckCircle2 size={32} />
          </div>
          <h4>Callback Request Received</h4>
          <p>
            Thank you! A clinical coordinator will contact you promptly at your mobile number to assist
            with test inquiries and sample collection.
          </p>
          <Button variant="outline" size="sm" onClick={resetState}>
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-callback-form">
      <div className="pl-callback-form__header">
        <h3>Request a Clinical Callback</h3>
        <p>
          {initialLabName
            ? `Connect directly with ${initialLabName}`
            : "Get test guidance and sample collection support from accredited labs"}
        </p>
      </div>

      <form className="pl-callback-form__form" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Your Full Name"
          placeholder="e.g., Rajesh Sharma"
          prefixIcon={User}
          required
          error={errors.name?.message}
          {...register("name")}
        />

        <Input
          label="Mobile Phone Number"
          placeholder="e.g., 9876543210"
          type="tel"
          prefixIcon={Phone}
          required
          error={errors.phone?.message}
          {...register("phone")}
        />

        <Input
          label="Email Address (Optional)"
          placeholder="e.g., rajesh@example.com"
          type="email"
          prefixIcon={Mail}
          error={errors.email?.message}
          {...register("email")}
        />

        <div className="pl-callback-form__textarea-group">
          <label htmlFor="message">Message or Test Inquired (Optional)</label>
          <textarea
            id="message"
            placeholder="Tell us which test you need or any specific assistance..."
            {...register("message")}
          />
          {errors.message && (
            <span style={{ fontSize: "0.75rem", color: "#DC2626" }}>
              {errors.message.message}
            </span>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
        >
          Submit Callback Request
        </Button>
      </form>
    </div>
  );
}
