import React, { useState } from "react";

import { EmailStatus } from "@/v1/uno_types";
import { createAnalyticsEvent } from "@/v1/utils";
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";

export default function (props: any) {
  const [email, setEmail] = useState("");
  const [signupDisabled, setSignupDisabled] = useState(false);

  function handleCreateWithEmail(e: any): boolean {
    e.preventDefault();

    createAnalyticsEvent(LegacyAnalyticsEvent.OnboardSignUpSubmit);

    setSignupDisabled(true);

    props
      .getEmailStatus(email)
      .then(function (emailStatus: EmailStatus) {
        switch (emailStatus) {
          case EmailStatus.Verified:
            createAnalyticsEvent(LegacyAnalyticsEvent.OnboardSignUpAlreadyExists);

            props.gotoSignIn(email);
            break;
          case EmailStatus.NotVerified:
            props.createWithEmail(email);
            break;
        }
      })
      .catch(function (e: any) {
        // XXX: this error handling doesnt make a lot of sense
        // but we use it everywhere..
        props.globalFailure(e);
      });

    return false;
  }

  function handleEmailChange(e: React.FormEvent): boolean {
    e.preventDefault();

    const target = e.target as typeof e.target & {
      value: string;
    };

    setEmail(target.value);

    return false;
  }

  return (
    <div className="w-row">
      <div className="column w-col w-col-6">
        <img src="images/logo_circular.svg" loading="lazy" alt="" className="image" />
        <div className="text-block">© 2023 WithUno, Inc.</div>
      </div>
      <div className="column-2 w-col w-col-6">
        <div className="div-block-2">
          <div className="div-block">
            <h4 className="heading">Welcome to Uno</h4>
            <div className="text-block-2">Let&#x27;s get started by creating your Uno account</div>
          </div>
          <div className="form-block w-form">
            <form
              id="email-form"
              name="email-form"
              data-name="Email Form"
              method="get"
              className="form"
              onSubmit={handleCreateWithEmail}
            >
              <input
                type="email"
                className="text-field w-input"
                maxLength={256}
                name="email"
                data-name="Email"
                placeholder="What&#x27;s your email?"
                id="email"
                required
                onChange={handleEmailChange}
                value={email}
              />
              <input
                type="submit"
                value={signupDisabled ? "Please wait ..." : "Sign up"}
                disabled={signupDisabled == true}
                data-wait="Please wait..."
                className="submit-button w-button"
              />
            </form>
            <div className="w-form-done">
              <div>Thank you! Your submission has been received!</div>
            </div>
            <div className="error-message w-form-fail">
              <div>Oops! Something went wrong while submitting the form.</div>
            </div>
          </div>
        </div>
        <div className="div-block-3">
          <div className="text-block-2">Already have an Uno account?</div>
          <a href="#" onClick={props.clickSignIn} className="button w-button whitespace-nowrap">
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
