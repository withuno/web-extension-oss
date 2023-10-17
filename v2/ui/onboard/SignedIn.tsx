import { UnoLogo } from "../popup/svgs";

export default function () {
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
        <p>Welcome back!</p>
        <p>
          <br />
        </p>
        <p>You can close this window now.</p>
      </span>
    </div>
  );
}
