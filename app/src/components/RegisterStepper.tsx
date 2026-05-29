interface RegisterStepperProps {
  step: number;
  labels: [string, string, string];
}

export function RegisterStepper({ step, labels }: RegisterStepperProps) {
  return (
    <nav className="register-stepper" aria-label="Progreso del registro">
      <ol>
        {labels.map((label, i) => {
          const n = i + 1;
          const state =
            n < step ? "done" : n === step ? "current" : "upcoming";
          return (
            <li key={label} className={state}>
              <span className="step-num" aria-hidden>
                {n < step ? "✓" : n}
              </span>
              <span className="step-label">{label}</span>
            </li>
          );
        })}
      </ol>
      <div
        className="stepper-progress"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={3}
      >
        <div
          className="stepper-progress-fill"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        />
      </div>
    </nav>
  );
}
