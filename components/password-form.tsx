type PasswordFormProps = {
  showError: boolean;
  defaultPasswordHint?: string;
};

export function PasswordForm({ showError, defaultPasswordHint }: PasswordFormProps) {
  return (
    <form className="login-form" action="/api/login" method="post">
      <label className="field-label" htmlFor="password">
        Shared password
      </label>
      <input
        className="field-input"
        id="password"
        name="password"
        type="password"
        placeholder="Enter the family password"
        required
      />
      {showError ? (
        <p className="form-message form-message--error">That password did not match.</p>
      ) : null}
      {defaultPasswordHint ? (
        <p className="form-message">Local dev fallback password: {defaultPasswordHint}</p>
      ) : null}
      <button className="primary-button" type="submit">
        Enter planner
      </button>
    </form>
  );
}
