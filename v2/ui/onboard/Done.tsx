import { useState } from "react";

import { NextArrow, UnoLogo } from "@/v2/ui/popup/svgs";

export default function () {
  const [stepNumber, setStepNumber] = useState(1);

  if (stepNumber === 1) {
    return (
      <div className="green-background">
        <div style={{ position: "absolute", top: "24px", left: "24px" }}>
          <UnoLogo />
        </div>
        <span
          style={{
            position: "absolute",
            top: "25vh",
            left: "64px",
            fontSize: "36px",
            fontWeight: "700",
            color: "#264E25",
          }}
        >
          Your Uno account has been created!
        </span>
        <div className="big-button-group">
          <button
            onClick={() => {
              setStepNumber(2);
            }}
            className="big-button"
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: "700",
              }}
            >
              NEXT
            </span>
            <NextArrow />
          </button>
        </div>
      </div>
    );
  }
  if (stepNumber === 2) {
    return (
      <div className="white-background">
        <div style={{ position: "absolute", top: "24px", left: "24px" }}>
          <UnoLogo />
        </div>

        <div
          style={{
            position: "absolute",
            display: "flex",
            gap: "20px",
            flexDirection: "column",
            top: "25vh",
            left: "64px",
          }}
        >
          <span
            style={{
              fontSize: "36px",
              fontWeight: "700",
            }}
          >
            Now, get to know the basics of Uno.
          </span>
          <span style={{ color: "#717280", fontWeight: "400" }}>
            Learn how to use the Uno extension through our demo tutorial.
          </span>
        </div>

        <div className="big-button-group">
          <button
            onClick={() => {
              window.open("https://demo.uno.app", "_blank");
            }}
            className="big-button green"
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Get started with the Interactive tutorial
            </span>
            <NextArrow />
          </button>

          <button
            onClick={() => {
              window.open("https://demo.uno.app?skip", "_blank");
            }}
            className="big-button skip"
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Skip
            </span>
            <NextArrow />
          </button>
        </div>
      </div>
    );
  }
  return <></>;
}
