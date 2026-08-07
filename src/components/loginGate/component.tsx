import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfigService } from "../../assets/lib/kookit-extra-browser.min";
import { setWebAuthed, verifyWebPassword } from "../../utils/selfHosted";
import "./loginGate.css";

const isDarkMode = () => {
  const skin = ConfigService.getReaderConfig("appSkin");
  const isOSNight = ConfigService.getReaderConfig("isOSNight");
  return skin === "night" || (skin === "system" && isOSNight === "yes");
};

const LoginGate = (props: { onSuccess: () => void }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async () => {
    if (!password || isChecking) {
      return;
    }
    setIsChecking(true);
    setError("");
    const passed = await verifyWebPassword(password);
    setIsChecking(false);
    if (passed) {
      setWebAuthed();
      props.onSuccess();
    } else {
      setError(t("Incorrect password"));
    }
  };

  return (
    <div
      className={
        "login-gate-container" + (isDarkMode() ? " login-gate-dark" : "")
      }
    >
      <div className="login-gate-form">
        <input
          type="password"
          className="login-gate-input"
          placeholder={t("Password")}
          value={password}
          autoFocus
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        <div className="login-gate-error">{error}</div>
        <div className="login-gate-button" onClick={handleSubmit}>
          {t("Log in")}
        </div>
      </div>
    </div>
  );
};

export default LoginGate;
